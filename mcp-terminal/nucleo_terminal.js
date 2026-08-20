/*
 * nucleo_terminal.js
 *
 * Nucleo compartido por los dos transportes:
 *   - servidor_terminal_mcp.js   (stdio, para Claude Code local)
 *   - servidor_terminal_http.js  (HTTP, para conectores remotos)
 *
 * Aqui viven las herramientas y el despachador JSON-RPC. El transporte solo
 * se encarga de mover mensajes; toda la logica de terminal esta en este archivo.
 */

'use strict';

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const NOMBRE_SERVIDOR = 'terminal-local';
const VERSION_SERVIDOR = '1.1.0';
const VERSION_PROTOCOLO_POR_DEFECTO = '2025-06-18';

const ES_WINDOWS = process.platform === 'win32';

/* El transporte inyecta aqui su funcion de traza (stdio la manda a stderr). */
let log = () => {};
function definirLog(fn) {
  log = fn;
}

/* ------------------------------------------------------------------ *
 * Configuracion
 * ------------------------------------------------------------------ */

/*
 * ALLOWLIST: null = shell completa sin restricciones (modo actual).
 *
 * Para restringir algun dia, sustituye null por un array de expresiones
 * regulares; solo se ejecutara lo que case con alguna de ellas:
 *
 *   const ALLOWLIST = [/^git( |$)/, /^npm( |$)/, /^docker( |$)/];
 */
const ALLOWLIST = null;

/* Limite de salida devuelta por llamada, para no inundar el contexto. */
const MAX_BYTES_SALIDA = Number(process.env.MCP_TERMINAL_MAX_SALIDA || 120000);

/* Timeout por defecto de los comandos sincronos, en milisegundos. */
const TIMEOUT_POR_DEFECTO = Number(process.env.MCP_TERMINAL_TIMEOUT || 120000);

/* Directorio de trabajo inicial. */
let cwdActual = process.env.MCP_TERMINAL_CWD || process.cwd();

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

/* Recorta por el centro conservando principio y final, que es donde
 * suele estar la informacion util (cabecera del comando y el error). */
function recortar(texto) {
  if (texto.length <= MAX_BYTES_SALIDA) return texto;
  const mitad = Math.floor(MAX_BYTES_SALIDA / 2);
  const omitidos = texto.length - MAX_BYTES_SALIDA;
  return (
    texto.slice(0, mitad) +
    '\n\n... [recortados ' + omitidos + ' caracteres del centro] ...\n\n' +
    texto.slice(texto.length - mitad)
  );
}

function resolverCwd(cwd) {
  const destino = cwd ? path.resolve(cwdActual, cwd) : cwdActual;
  if (!fs.existsSync(destino)) {
    throw new Error('El directorio no existe: ' + destino);
  }
  return destino;
}

function comprobarAllowlist(comando) {
  if (!ALLOWLIST) return;
  const permitido = ALLOWLIST.some((re) => re.test(comando.trim()));
  if (!permitido) {
    throw new Error('Comando bloqueado por la allowlist: ' + comando);
  }
}

/*
 * Devuelve [ejecutable, argumentos] para lanzar un comando en el shell pedido.
 * En cmd.exe anteponemos "chcp 65001" para que los acentos y los simbolos
 * no lleguen destrozados por la pagina de codigos OEM.
 */
function construirInvocacion(comando, shell) {
  const elegido = !shell || shell === 'auto' ? (ES_WINDOWS ? 'cmd' : 'sh') : shell;

  switch (elegido) {
    case 'cmd':
      return ['cmd.exe', ['/d', '/s', '/c', 'chcp 65001>nul & ' + comando]];
    case 'powershell':
      return [
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + comando,
        ],
      ];
    case 'bash':
      return ['bash', ['-lc', comando]];
    case 'sh': {
      const shellUsuario = process.env.SHELL || '/bin/sh';
      return [shellUsuario, ['-lc', comando]];
    }
    default:
      throw new Error('Shell no reconocido: ' + elegido);
  }
}

/* Mata el arbol de procesos completo, no solo el padre. */
function matarArbol(hijo) {
  if (hijo.exitCode !== null || hijo.signalCode !== null) return;
  if (ES_WINDOWS) {
    spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-hijo.pid, 'SIGKILL');
    } catch (_) {
      try {
        hijo.kill('SIGKILL');
      } catch (_) {}
    }
  }
}

/* ------------------------------------------------------------------ *
 * Procesos en segundo plano
 * ------------------------------------------------------------------ */

const procesos = new Map();
let contadorProcesos = 0;

function registrarProceso(comando, hijo, cwd) {
  const id = 'p' + ++contadorProcesos;
  const registro = {
    id,
    comando,
    cwd,
    pid: hijo.pid,
    hijo,
    buffer: '',
    leidoHasta: 0,
    terminado: false,
    codigoSalida: null,
    iniciado: new Date().toISOString(),
  };

  const acumular = (fragmento) => {
    registro.buffer += fragmento.toString('utf8');
    /* Evita que un proceso muy verboso consuma memoria sin limite. */
    if (registro.buffer.length > MAX_BYTES_SALIDA * 8) {
      const exceso = registro.buffer.length - MAX_BYTES_SALIDA * 8;
      registro.buffer = registro.buffer.slice(exceso);
      registro.leidoHasta = Math.max(0, registro.leidoHasta - exceso);
    }
  };

  hijo.stdout.on('data', acumular);
  hijo.stderr.on('data', acumular);
  hijo.on('close', (codigo) => {
    registro.terminado = true;
    registro.codigoSalida = codigo;
  });
  hijo.on('error', (err) => {
    registro.terminado = true;
    registro.buffer += '\n[error al lanzar el proceso] ' + err.message + '\n';
  });

  procesos.set(id, registro);
  return registro;
}

/* ------------------------------------------------------------------ *
 * Implementacion de las herramientas
 * ------------------------------------------------------------------ */

function ejecutarComando({ command, cwd, timeout_ms, shell, stdin }) {
  comprobarAllowlist(command);
  const directorio = resolverCwd(cwd);
  const limite = Number(timeout_ms) > 0 ? Number(timeout_ms) : TIMEOUT_POR_DEFECTO;
  const [ejecutable, argumentos] = construirInvocacion(command, shell);

  return new Promise((resolve) => {
    const hijo = spawn(ejecutable, argumentos, {
      cwd: directorio,
      env: process.env,
      windowsHide: true,
      detached: !ES_WINDOWS,
    });

    let salida = '';
    let expirado = false;

    const temporizador = setTimeout(() => {
      expirado = true;
      matarArbol(hijo);
    }, limite);

    hijo.stdout.on('data', (d) => (salida += d.toString('utf8')));
    hijo.stderr.on('data', (d) => (salida += d.toString('utf8')));

    if (stdin) {
      hijo.stdin.write(stdin);
    }
    hijo.stdin.end();

    hijo.on('error', (err) => {
      clearTimeout(temporizador);
      resolve({
        texto:
          'No se pudo lanzar el comando: ' + err.message +
          '\ncomando: ' + command +
          '\ndirectorio: ' + directorio,
        esError: true,
      });
    });

    hijo.on('close', (codigo) => {
      clearTimeout(temporizador);
      const cabecera =
        '$ ' + command +
        '\n[directorio] ' + directorio +
        '\n[codigo de salida] ' + (expirado ? 'TIMEOUT tras ' + limite + ' ms' : codigo) +
        '\n---\n';
      resolve({
        texto: cabecera + (recortar(salida) || '(sin salida)'),
        esError: expirado || codigo !== 0,
      });
    });
  });
}

function iniciarProceso({ command, cwd, shell }) {
  comprobarAllowlist(command);
  const directorio = resolverCwd(cwd);
  const [ejecutable, argumentos] = construirInvocacion(command, shell);

  const hijo = spawn(ejecutable, argumentos, {
    cwd: directorio,
    env: process.env,
    windowsHide: true,
    detached: !ES_WINDOWS,
  });

  const registro = registrarProceso(command, hijo, directorio);
  return {
    texto:
      'Proceso iniciado en segundo plano.\n' +
      'id: ' + registro.id + '\n' +
      'pid: ' + registro.pid + '\n' +
      'comando: ' + command + '\n' +
      'directorio: ' + directorio + '\n\n' +
      'Usa read_output con id="' + registro.id + '" para ver como avanza.',
    esError: false,
  };
}

function leerSalida({ id, desde_el_principio }) {
  const registro = procesos.get(id);
  if (!registro) throw new Error('No existe ningun proceso con id: ' + id);

  const inicio = desde_el_principio ? 0 : registro.leidoHasta;
  const nuevo = registro.buffer.slice(inicio);
  registro.leidoHasta = registro.buffer.length;

  const estado = registro.terminado
    ? 'terminado (codigo ' + registro.codigoSalida + ')'
    : 'en ejecucion';

  return {
    texto:
      '[' + registro.id + '] ' + registro.comando +
      '\n[estado] ' + estado +
      '\n---\n' + (recortar(nuevo) || '(sin salida nueva)'),
    esError: false,
  };
}

function escribirStdin({ id, data, salto_de_linea }) {
  const registro = procesos.get(id);
  if (!registro) throw new Error('No existe ningun proceso con id: ' + id);
  if (registro.terminado) throw new Error('El proceso ' + id + ' ya termino.');

  const texto = salto_de_linea === false ? data : data + os.EOL;
  registro.hijo.stdin.write(texto);
  return { texto: 'Enviado a la entrada estandar de ' + id + '.', esError: false };
}

function matarProceso({ id }) {
  const registro = procesos.get(id);
  if (!registro) throw new Error('No existe ningun proceso con id: ' + id);
  matarArbol(registro.hijo);
  return { texto: 'Proceso ' + id + ' (pid ' + registro.pid + ') terminado.', esError: false };
}

function listarProcesos() {
  if (procesos.size === 0) {
    return { texto: 'No hay procesos en segundo plano.', esError: false };
  }
  const lineas = [...procesos.values()].map((p) => {
    const estado = p.terminado ? 'terminado(' + p.codigoSalida + ')' : 'vivo';
    return [p.id, 'pid=' + p.pid, estado, p.iniciado, p.comando].join('  ');
  });
  return { texto: lineas.join('\n'), esError: false };
}

function cambiarDirectorio({ path: destino }) {
  const resuelto = resolverCwd(destino);
  cwdActual = resuelto;
  return { texto: 'Directorio de trabajo: ' + cwdActual, esError: false };
}

function infoSistema() {
  const datos = {
    plataforma: process.platform,
    arquitectura: process.arch,
    version_so: os.release(),
    host: os.hostname(),
    usuario: os.userInfo().username,
    node: process.version,
    shell_por_defecto: ES_WINDOWS ? 'cmd.exe' : process.env.SHELL || '/bin/sh',
    directorio_actual: cwdActual,
    home: os.homedir(),
    cpus: os.cpus().length,
    memoria_total_gb: (os.totalmem() / 1024 ** 3).toFixed(1),
    allowlist: ALLOWLIST ? 'activa' : 'desactivada (shell completa)',
  };
  const lineas = Object.entries(datos).map(([k, v]) => k.padEnd(22) + v);
  return { texto: lineas.join('\n'), esError: false };
}

/* ------------------------------------------------------------------ *
 * Catalogo de herramientas expuestas por MCP
 * ------------------------------------------------------------------ */

const HERRAMIENTAS = [
  {
    name: 'run_command',
    description:
      'Ejecuta un comando en la terminal de esta maquina y espera a que termine. ' +
      'Devuelve la salida combinada (stdout + stderr) y el codigo de salida. ' +
      'Para procesos largos o servidores que no terminan solos, usa start_process.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Linea de comando a ejecutar.' },
        cwd: {
          type: 'string',
          description: 'Directorio de trabajo. Relativo al actual si no es absoluto.',
        },
        timeout_ms: {
          type: 'number',
          description: 'Milisegundos antes de matar el comando. Por defecto 120000.',
        },
        shell: {
          type: 'string',
          enum: ['auto', 'cmd', 'powershell', 'bash', 'sh'],
          description: 'Interprete a usar. Por defecto auto (cmd en Windows, sh en Unix).',
        },
        stdin: {
          type: 'string',
          description: 'Texto a enviar por la entrada estandar antes de cerrarla.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'start_process',
    description:
      'Lanza un comando en segundo plano y devuelve enseguida un id. ' +
      'Pensado para servidores de desarrollo, watchers, builds largos o cualquier ' +
      'proceso interactivo. La salida se consulta despues con read_output.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Linea de comando a ejecutar.' },
        cwd: { type: 'string', description: 'Directorio de trabajo.' },
        shell: {
          type: 'string',
          enum: ['auto', 'cmd', 'powershell', 'bash', 'sh'],
          description: 'Interprete a usar.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_output',
    description:
      'Lee la salida acumulada de un proceso lanzado con start_process. ' +
      'Por defecto devuelve solo lo nuevo desde la ultima lectura.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Identificador devuelto por start_process.' },
        desde_el_principio: {
          type: 'boolean',
          description: 'true para releer toda la salida desde el inicio.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'write_stdin',
    description:
      'Escribe texto en la entrada estandar de un proceso en segundo plano, ' +
      'para responder a prompts interactivos (confirmaciones, contrasenas de sudo, REPLs).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Identificador del proceso.' },
        data: { type: 'string', description: 'Texto a enviar.' },
        salto_de_linea: {
          type: 'boolean',
          description: 'Anadir salto de linea al final. Por defecto true.',
        },
      },
      required: ['id', 'data'],
    },
  },
  {
    name: 'kill_process',
    description: 'Mata un proceso en segundo plano y todos sus hijos.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identificador del proceso.' } },
      required: ['id'],
    },
  },
  {
    name: 'list_processes',
    description: 'Lista los procesos en segundo plano de esta sesion, con su estado.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_cwd',
    description:
      'Cambia el directorio de trabajo por defecto para las siguientes llamadas. ' +
      'Equivale a un cd que persiste entre comandos.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Ruta del nuevo directorio.' } },
      required: ['path'],
    },
  },
  {
    name: 'system_info',
    description:
      'Describe la maquina: sistema operativo, usuario, shell, directorio actual, ' +
      'CPU y memoria. Util como primera llamada para orientarse.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const IMPLEMENTACIONES = {
  run_command: ejecutarComando,
  start_process: iniciarProceso,
  read_output: leerSalida,
  write_stdin: escribirStdin,
  kill_process: matarProceso,
  list_processes: listarProcesos,
  set_cwd: cambiarDirectorio,
  system_info: infoSistema,
};

/* ------------------------------------------------------------------ *
 * Despachador JSON-RPC (comun a todos los transportes)
 * ------------------------------------------------------------------ */

/*
 * Procesa un mensaje JSON-RPC y devuelve la respuesta, o null si el mensaje
 * era una notificacion y no procede contestar.
 */
async function manejarMensaje(mensaje) {
  const { id, method, params } = mensaje;
  const esNotificacion = id === undefined || id === null;

  const ok = (result) => (esNotificacion ? null : { jsonrpc: '2.0', id, result });
  const fallo = (code, message) =>
    esNotificacion ? null : { jsonrpc: '2.0', id, error: { code, message } };

  switch (method) {
    case 'initialize': {
      const solicitada = params && params.protocolVersion;
      log('cliente conectado; cwd =', cwdActual);
      return ok({
        protocolVersion: solicitada || VERSION_PROTOCOLO_POR_DEFECTO,
        capabilities: { tools: {} },
        serverInfo: { name: NOMBRE_SERVIDOR, version: VERSION_SERVIDOR },
      });
    }

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return ok({});

    case 'tools/list':
      return ok({ tools: HERRAMIENTAS });

    case 'tools/call': {
      const nombre = params && params.name;
      const argumentos = (params && params.arguments) || {};
      const impl = IMPLEMENTACIONES[nombre];

      if (!impl) return fallo(-32602, 'Herramienta desconocida: ' + nombre);

      try {
        const resultado = await impl(argumentos);
        return ok({
          content: [{ type: 'text', text: resultado.texto }],
          isError: Boolean(resultado.esError),
        });
      } catch (err) {
        /* Los fallos previsibles (ruta inexistente, proceso muerto) vuelven
         * como isError para que el modelo pueda corregirse solo. */
        return ok({
          content: [{ type: 'text', text: 'Error: ' + err.message }],
          isError: true,
        });
      }
    }

    default:
      return fallo(-32601, 'Metodo no implementado: ' + method);
  }
}

/* Mata todo lo que quede vivo. Lo llaman los transportes al cerrar. */
function limpiar() {
  for (const registro of procesos.values()) {
    if (!registro.terminado) matarArbol(registro.hijo);
  }
}

module.exports = {
  NOMBRE_SERVIDOR,
  VERSION_SERVIDOR,
  VERSION_PROTOCOLO_POR_DEFECTO,
  HERRAMIENTAS,
  manejarMensaje,
  definirLog,
  limpiar,
};
