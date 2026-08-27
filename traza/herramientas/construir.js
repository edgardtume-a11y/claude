/*
 * TRAZA v1.0.0 — construir.js
 * Ensambla dist/traza.html y dist/pruebas.html incrustando el núcleo, la
 * interfaz y los estilos en cada archivo. Después verifica que el resultado
 * sea autocontenido: sin URL externas, sin fetch/XHR/WebSocket y sin
 * clasificadores de direcciones IP.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SRC = path.join(RAIZ, "src");
const DIST = path.join(RAIZ, "dist");

function leer(nombre) {
  return fs.readFileSync(path.join(SRC, nombre), "utf8");
}

const nucleo = leer("nucleo.js");
const app = leer("app.js");
const estilos = leer("estilos.css");
const pruebasDef = leer("pruebas-def.js");

function ensamblar(plantilla, reemplazos) {
  let salida = plantilla;
  for (const [marca, contenido] of Object.entries(reemplazos)) {
    const token = "{{" + marca + "}}";
    if (!salida.includes(token)) throw new Error("Falta el marcador " + token);
    salida = salida.replace(token, () => contenido);
  }
  if (/\{\{[A-Z_]+\}\}/.test(salida)) {
    throw new Error("Quedaron marcadores sin sustituir");
  }
  return salida;
}

const traza = ensamblar(leer("plantilla-traza.html"), { ESTILOS: estilos, NUCLEO: nucleo, APP: app });
const pruebas = ensamblar(leer("plantilla-pruebas.html"), { NUCLEO: nucleo, PRUEBAS_DEF: pruebasDef });

/* ------------------------------------------------------------------ */
/* Verificaciones de autocontención y alcance                          */
/* ------------------------------------------------------------------ */
const PROHIBIDOS = [
  { patron: /https?:\/\//i, motivo: "URL externa (http/https)" },
  { patron: /\/\/(?:cdn|unpkg|jsdelivr|fonts)\./i, motivo: "referencia a CDN" },
  { patron: /<link[^>]+href/i, motivo: "hoja de estilos o recurso enlazado" },
  { patron: /@import/i, motivo: "importación CSS externa" },
  { patron: /url\(\s*['"]?(?!data:)[a-z]+:/i, motivo: "url() hacia un esquema externo" },
  { patron: /fetch\s*\(/, motivo: "llamada fetch" },
  { patron: /XMLHttpRequest/, motivo: "XMLHttpRequest" },
  { patron: /WebSocket/, motivo: "WebSocket" },
  { patron: /EventSource/, motivo: "EventSource" },
  { patron: /sendBeacon/, motivo: "sendBeacon (telemetría)" },
  { patron: /importScripts/, motivo: "importScripts" },
  { patron: /<script[^>]+src=/i, motivo: "script externo" },
  { patron: /<img[^>]+src=\s*["'](?!data:)/i, motivo: "imagen externa" },
  { patron: /es[_]?privada|is[_]?private|clasificarIp|esPublica/i, motivo: "clasificador de IP pública/privada (fuera de alcance)" },
  { patron: /Math\.random/, motivo: "azar (la simulación debe ser determinista)" },
  { patron: /\beval\s*\(/, motivo: "eval" }
];

function verificar(nombre, contenido) {
  const problemas = [];
  for (const regla of PROHIBIDOS) {
    const m = contenido.match(regla.patron);
    if (m) {
      const donde = contenido.indexOf(m[0]);
      const linea = contenido.slice(0, donde).split("\n").length;
      problemas.push(`  ${nombre}: ${regla.motivo} en la línea ${linea}: «${m[0]}»`);
    }
  }
  return problemas;
}

const problemas = [...verificar("traza.html", traza), ...verificar("pruebas.html", pruebas)];
if (problemas.length > 0) {
  console.error("VERIFICACIÓN FALLIDA — contenido prohibido en la construcción:");
  for (const p of problemas) console.error(p);
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, "traza.html"), traza);
fs.writeFileSync(path.join(DIST, "pruebas.html"), pruebas);

console.log("Construcción correcta y verificación de autocontención superada:");
console.log(`  dist/traza.html   ${(traza.length / 1024).toFixed(1)} KiB`);
console.log(`  dist/pruebas.html ${(pruebas.length / 1024).toFixed(1)} KiB`);
