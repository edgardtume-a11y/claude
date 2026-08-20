#!/usr/bin/env node
/*
 * servidor_terminal_mcp.js — transporte stdio.
 *
 * Es el que usa Claude Code cuando corre en TU maquina: lanza este proceso
 * y habla con el por entrada/salida estandar.
 *
 * Registro:
 *   claude mcp add terminal-local --scope user -- node /ruta/servidor_terminal_mcp.js
 *
 * stdout esta reservado para los mensajes JSON-RPC; las trazas van a stderr.
 */

'use strict';

const nucleo = require('./nucleo_terminal');

nucleo.definirLog((...args) => {
  process.stderr.write('[' + nucleo.NOMBRE_SERVIDOR + '] ' + args.join(' ') + '\n');
});

function enviar(mensaje) {
  process.stdout.write(JSON.stringify(mensaje) + '\n');
}

/* Peticiones en vuelo: si stdin se cierra con trabajo a medias hay que dejar
 * que terminen antes de salir, o el cliente pierde las respuestas. */
let enVuelo = 0;
let cerrando = false;

function salir() {
  nucleo.limpiar();
  /* Un tick de margen para que stdout vacie el ultimo JSON. */
  setTimeout(() => process.exit(0), 10);
}

/* Los mensajes stdio de MCP van separados por saltos de linea. */
let pendiente = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (trozo) => {
  pendiente += trozo;
  let corte;
  while ((corte = pendiente.indexOf('\n')) !== -1) {
    const linea = pendiente.slice(0, corte).trim();
    pendiente = pendiente.slice(corte + 1);
    if (!linea) continue;

    let mensaje;
    try {
      mensaje = JSON.parse(linea);
    } catch (err) {
      process.stderr.write('[' + nucleo.NOMBRE_SERVIDOR + '] linea JSON invalida\n');
      continue;
    }

    enVuelo++;
    nucleo
      .manejarMensaje(mensaje)
      .then((respuesta) => {
        if (respuesta) enviar(respuesta);
      })
      .catch((err) => {
        if (mensaje.id !== undefined && mensaje.id !== null) {
          enviar({
            jsonrpc: '2.0',
            id: mensaje.id,
            error: { code: -32603, message: 'Error interno: ' + err.message },
          });
        }
      })
      .finally(() => {
        enVuelo--;
        if (cerrando && enVuelo === 0) salir();
      });
  }
});

process.stdin.on('end', () => {
  cerrando = true;
  if (enVuelo === 0) salir();
});

process.stderr.write(
  '[' + nucleo.NOMBRE_SERVIDOR + '] listo por stdio (' +
  process.platform + ', node ' + process.version + ')\n'
);
