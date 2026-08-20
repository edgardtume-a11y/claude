#!/usr/bin/env node
/*
 * servidor_terminal_http.js — transporte HTTP.
 *
 * Publica las mismas herramientas que el servidor stdio, pero por red, para
 * que un cliente MCP remoto (por ejemplo Claude en la web, via conector
 * personalizado) pueda alcanzarlas a traves de un tunel.
 *
 * Implementa los dos transportes que se encuentran en la practica:
 *   - Streamable HTTP:  POST /mcp
 *   - SSE clasico:      GET /sse  +  POST /mensajes
 *
 * Autenticacion por token. Se acepta de tres formas, porque no todos los
 * clientes dejan poner cabeceras:
 *   - Cabecera:  Authorization: Bearer <token>
 *   - Ruta:      /mcp/<token>   o   /sse/<token>
 *   - Query:     ?token=<token>
 *
 * Uso:
 *   MCP_TERMINAL_TOKEN=mi-token node servidor_terminal_http.js
 *   node servidor_terminal_http.js --puerto 8765
 *
 * Sin MCP_TERMINAL_TOKEN se genera uno aleatorio y se imprime al arrancar.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nucleo = require('./nucleo_terminal');
const oauth = require('./oauth_terminal');

const argumentos = process.argv.slice(2);
function opcion(nombre, pordefecto) {
  const i = argumentos.indexOf('--' + nombre);
  return i !== -1 && argumentos[i + 1] ? argumentos[i + 1] : pordefecto;
}

const PUERTO = Number(opcion('puerto', process.env.MCP_TERMINAL_PUERTO || 8765));
/* Por defecto solo escucha en loopback: se sale a internet por el tunel,
 * no exponiendo el puerto directamente a la red local. */
const HOST = opcion('host', process.env.MCP_TERMINAL_HOST || '127.0.0.1');

/*
 * Token estatico. Orden de preferencia:
 *   1. MCP_TERMINAL_TOKEN
 *   2. el archivo .token junto a este script
 *   3. uno nuevo, que ademas se guarda en .token
 *
 * Leer el archivo importa: si cada arranque generase un token distinto,
 * comprobar.sh y cualquier script guardado dejarian de funcionar en cuanto
 * se reiniciara el servidor.
 */
function resolverToken() {
  if (process.env.MCP_TERMINAL_TOKEN) return process.env.MCP_TERMINAL_TOKEN;

  const archivo = path.join(__dirname, '.token');
  try {
    const guardado = fs.readFileSync(archivo, 'utf8').trim();
    if (guardado) return guardado;
  } catch (err) {
    /* No existe todavia: se crea abajo. */
  }

  const nuevo = crypto.randomBytes(24).toString('hex');
  try {
    fs.writeFileSync(archivo, nuevo + '\n', { mode: 0o600 });
  } catch (err) {
    process.stderr.write('[aviso] no se pudo guardar .token: ' + err.message + '\n');
  }
  return nuevo;
}

const TOKEN = resolverToken();

function log(...args) {
  process.stderr.write('[' + nucleo.NOMBRE_SERVIDOR + ':http] ' + args.join(' ') + '\n');
}
nucleo.definirLog(log);

/* Comparacion en tiempo constante: un token no deberia poder adivinarse
 * midiendo cuanto tarda el rechazo. */
function tokenValido(candidato) {
  if (typeof candidato !== 'string') return false;
  const a = Buffer.from(candidato);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cabecerasCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

function json(res, codigo, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  cabecerasCors(res);
  res.writeHead(codigo, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (t) => {
      datos += t;
      /* Un cuerpo JSON-RPC legitimo nunca se acerca a este tamano. */
      if (datos.length > 4 * 1024 * 1024) {
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ *
 * Sesiones SSE (transporte clasico)
 * ------------------------------------------------------------------ */

const sesiones = new Map();

function abrirSse(res, idSesion) {
  cabecerasCors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  /* El cliente descubre por aqui a donde mandar sus peticiones. */
  const destino = '/mensajes?sesion=' + idSesion + '&token=' + encodeURIComponent(TOKEN);
  res.write('event: endpoint\ndata: ' + destino + '\n\n');

  /* Comentario periodico: mantiene viva la conexion a traves del tunel. */
  const latido = setInterval(() => res.write(': latido\n\n'), 15000);

  sesiones.set(idSesion, {
    enviar: (mensaje) => res.write('event: message\ndata: ' + JSON.stringify(mensaje) + '\n\n'),
    cerrar: () => {
      clearInterval(latido);
      sesiones.delete(idSesion);
    },
  });

  res.on('close', () => {
    clearInterval(latido);
    sesiones.delete(idSesion);
    log('sesion SSE cerrada:', idSesion);
  });
}

/* ------------------------------------------------------------------ *
 * Encaminamiento
 * ------------------------------------------------------------------ */

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const partes = url.pathname.split('/').filter(Boolean);
  const ruta = '/' + (partes[0] || '');

  if (req.method === 'OPTIONS') {
    cabecerasCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  /* Pagina de estado: sin token, y sin filtrar nada sensible. */
  if (ruta === '/' || ruta === '/salud') {
    json(res, 200, {
      servidor: nucleo.NOMBRE_SERVIDOR,
      version: nucleo.VERSION_SERVIDOR,
      transportes: ['POST /mcp', 'GET /sse + POST /mensajes'],
      herramientas: nucleo.HERRAMIENTAS.length,
      autenticacion: 'token estatico u OAuth',
    });
    return;
  }

  /* Endpoints de OAuth (descubrimiento, registro, autorizacion, token). Son
   * publicos por definicion: es el mecanismo con el que claude.ai obtiene sus
   * credenciales. Si el modulo atiende la peticion, aqui hemos terminado. */
  if (await oauth.manejar(req, res, url, cabecerasCors, tokenValido)) return;

  const cabecera = req.headers.authorization || '';
  const tokenCabecera = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;
  const tokenRuta = partes[1] || null;
  const tokenQuery = url.searchParams.get('token');
  /* Se acepta el token estatico "de siempre" o un token de acceso emitido por
   * el flujo OAuth (el que usara claude.ai). */
  const autorizado =
    [tokenCabecera, tokenRuta, tokenQuery].some(tokenValido) ||
    oauth.tokenAccesoValido(tokenCabecera);

  if (!autorizado) {
    log('rechazado', req.method, url.pathname, 'desde', req.socket.remoteAddress);
    /* Apuntar al recurso protegido hace que un cliente MCP arranque el flujo
     * OAuth en vez de rendirse. */
    const base = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim() +
      '://' + (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
    res.setHeader(
      'WWW-Authenticate',
      'Bearer resource_metadata="' + base + '/.well-known/oauth-protected-resource"'
    );
    json(res, 401, { error: 'token invalido o ausente' });
    return;
  }

  /* --- Streamable HTTP --- */
  if (ruta === '/mcp' && req.method === 'POST') {
    let mensaje;
    try {
      mensaje = JSON.parse(await leerCuerpo(req));
    } catch (err) {
      json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido' } });
      return;
    }

    /* Un lote es un array de mensajes; se contesta solo lo que no sea notificacion. */
    if (Array.isArray(mensaje)) {
      const respuestas = (await Promise.all(mensaje.map((m) => nucleo.manejarMensaje(m)))).filter(Boolean);
      if (respuestas.length === 0) {
        cabecerasCors(res);
        res.writeHead(202);
        res.end();
        return;
      }
      json(res, 200, respuestas);
      return;
    }

    const respuesta = await nucleo.manejarMensaje(mensaje);
    if (!respuesta) {
      cabecerasCors(res);
      res.writeHead(202);
      res.end();
      return;
    }
    json(res, 200, respuesta);
    return;
  }

  /* El spec permite responder 405 al GET si no hay canal servidor->cliente. */
  if (ruta === '/mcp' && req.method === 'GET') {
    cabecerasCors(res);
    res.writeHead(405, { Allow: 'POST' });
    res.end();
    return;
  }

  /* --- SSE clasico --- */
  if (ruta === '/sse' && req.method === 'GET') {
    const idSesion = crypto.randomUUID();
    log('sesion SSE abierta:', idSesion);
    abrirSse(res, idSesion);
    return;
  }

  if (ruta === '/mensajes' && req.method === 'POST') {
    const idSesion = url.searchParams.get('sesion');
    const sesion = sesiones.get(idSesion);
    if (!sesion) {
      json(res, 404, { error: 'sesion desconocida: ' + idSesion });
      return;
    }

    let mensaje;
    try {
      mensaje = JSON.parse(await leerCuerpo(req));
    } catch (err) {
      json(res, 400, { error: 'JSON invalido' });
      return;
    }

    /* En este transporte la respuesta viaja por el canal SSE, no por el POST. */
    cabecerasCors(res);
    res.writeHead(202);
    res.end();

    const respuesta = await nucleo.manejarMensaje(mensaje);
    if (respuesta) sesion.enviar(respuesta);
    return;
  }

  json(res, 404, { error: 'ruta no encontrada: ' + url.pathname });
});

servidor.listen(PUERTO, HOST, () => {
  const base = 'http://' + HOST + ':' + PUERTO;
  process.stderr.write(
    '\n' +
    '  Servidor MCP de terminal escuchando\n' +
    '  ----------------------------------\n' +
    '  local ......... ' + base + '\n' +
    '  token ......... ' + TOKEN + '\n' +
    '  herramientas .. ' + nucleo.HERRAMIENTAS.length + '\n\n' +
    '  Publicalo con un tunel y usa como URL del conector:\n' +
    '    https://<tu-tunel>/mcp/' + TOKEN + '\n\n' +
    '  Cualquiera con esa URL puede ejecutar comandos en esta maquina.\n\n'
  );
});

function apagar() {
  log('cerrando');
  for (const sesion of sesiones.values()) sesion.cerrar();
  nucleo.limpiar();
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
