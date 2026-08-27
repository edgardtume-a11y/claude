/* Comprobación independiente del conjunto de práctica contra SOLUCIONES.md.
   Herramienta de desarrollo: no forma parte del paquete entregado. */
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "entrega2");
const log = fs.readFileSync(path.join(DIR, "traza_practica.log"), "utf8").split("\n");
const sol = fs.readFileSync(path.join(DIR, "SOLUCIONES.md"), "utf8");
const doc = JSON.parse(fs.readFileSync(path.join(DIR, "traza_practica.json"), "utf8"));
const linea = n => log[n - 1]; // 1-based

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? "PASA " : "FALLA") + " " + msg); if (!cond) fallos++; };

/* formatos válidos */
const reA = /^\[\+\s*\d+ ms\] E\d{4}\s+\S+.*:: .*\(SINTETICO\)\s*$/;
const reB = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|E\d{4}\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|SINTETICO$/;

/* 1. corte de formato */
const numCorte = Number(sol.match(/Línea (\d+)\*\*: aparece/)[1]);
ok(linea(numCorte).includes("# reinicio del recolector"), "corte de formato en línea " + numCorte);
ok(reA.test(linea(numCorte - 1)), "línea anterior al corte es formato A");
ok(reB.test(linea(numCorte + 1)), "línea posterior al corte es formato B");

/* 2. extraer todas las citas "Línea(s) N[, M…]" de las secciones 2.2–2.7 y validarlas */
function numerosDeSeccion(titulo, siguiente) {
  const bloque = sol.split(titulo)[1].split(siguiente)[0];
  const nums = [];
  for (const m of bloque.matchAll(/Líneas? ([\d, ]+) —/g)) {
    for (const n of m[1].split(",")) nums.push(Number(n.trim()));
  }
  return nums;
}
const malformadas = numerosDeSeccion("### 2.2", "### 2.3");
ok(malformadas.length === 6, "6 líneas malformadas citadas (" + malformadas.join(",") + ")");
ok(malformadas.every(n => !reA.test(linea(n)) && !reB.test(linea(n))),
  "todas las líneas malformadas citadas incumplen ambos formatos");

const duplicadas = numerosDeSeccion("### 2.3", "### 2.4");
ok(duplicadas.length === 10, "10 líneas duplicadas citadas");
ok(duplicadas.every(n => log.filter(l => l === linea(n)).length >= 2),
  "cada línea duplicada citada aparece al menos dos veces en el archivo");

const desorden = numerosDeSeccion("### 2.4", "### 2.5");
function tDe(l) {
  let m = l.match(/^\[\+\s*(-?\d+) ms\]/); if (m) return Number(m[1]);
  m = l.match(/^(\d{4}-[^|]+)\|/); if (m) return Date.parse(m[1]);
  return null;
}
const bloques = sol.split("### 2.4")[1].split("### 2.5")[0];
ok(/bloque de 12 líneas rotado/.test(bloques), "la sección de desorden describe el bloque rotado");
/* el bloque rotado debe contener al menos un descenso de t */
const numsBloque = desorden.slice(0, 12);
let desciende = false;
for (let i = 1; i < numsBloque.length; i++) {
  const a = tDe(linea(numsBloque[i - 1])), b = tDe(linea(numsBloque[i]));
  if (a !== null && b !== null && b < a) desciende = true;
}
ok(desciende, "el bloque rotado contiene marcas de tiempo no monótonas");

const noAscii = numerosDeSeccion("### 2.5", "### 2.6");
ok(noAscii.every(n => /Ã|�| /.test(linea(n))), "todas las líneas no ASCII citadas contienen Ã, � o U+00A0");

const reloj = numerosDeSeccion("### 2.6", "### 2.7");
ok(reloj.every(n => /^2036-/.test(linea(n)) || /\[\+\s*-\d+ ms\]/.test(linea(n))),
  "todas las líneas de reloj citadas tienen fecha 2036 o t negativo");

const vacios = numerosDeSeccion("### 2.7", "## 3");
ok(vacios.every(n => linea(n).includes("||")), "las líneas con campo vacío citadas contienen ||");

/* 3. suciedad del JSON */
const porId = {};
doc.eventos.forEach(e => { porId[e.id] = (porId[e.id] || 0) + 1; });
ok(["E0212", "E0847", "E1633", "E2405"].every(id => porId[id] === 2), "objetos duplicados presentes (id ×2)");
ok(porId["E0500"] === 2, "colisión de id E0500 presente");
const e0500 = doc.eventos.filter(e => e.id === "E0500");
ok(e0500[0].t_ms !== e0500[1].t_ms, "los dos E0500 tienen t_ms distintos (contenido distinto)");
ok(doc.eventos.filter(e => e.protocolo === "").length === 3, "3 eventos con protocolo vacío");
ok(doc.eventos.filter(e => e.estado === "").length === 2, "2 eventos con estado vacío");
ok(doc.eventos.some(e => e.id === "E1502" && !("estado" in e)), "E1502 sin campo estado");
ok(doc.eventos.some(e => e.id === "E1099" && typeof e.t_ms === "string"), "E1099 con t_ms como texto");
ok(doc.eventos.some(e => /Ã/.test(e.resumen)), "hay un evento con mojibake en el resumen");
let fueraDeOrden = 0;
for (let i = 1; i < doc.eventos.length; i++) {
  if (Number(doc.eventos[i].t_ms) < Number(doc.eventos[i - 1].t_ms)) fueraDeOrden++;
}
ok(fueraDeOrden >= 3, "el JSON tiene los 3 desórdenes cronológicos plantados (" + fueraDeOrden + " descensos)");

/* 4. patrones de comportamiento */
const rafaga = doc.eventos.filter(e => e.origen_ip === "203.0.113.66" || e.destino_ip === "203.0.113.66");
ok(rafaga.filter(e => /401/.test(e.resumen)).length === 44, "ráfaga: 44 respuestas 401");
ok(rafaga.filter(e => /429/.test(e.resumen)).length === 1, "ráfaga: una respuesta 429");
const nx = doc.eventos.filter(e => /NXDOMAIN/.test(e.resumen));
ok(nx.length === 70, "70 respuestas NXDOMAIN del sensor IoT (" + nx.length + ")");
ok(nx.every(e => e.destino_ip === "192.168.1.25"), "todas las NXDOMAIN van al sensor 192.168.1.25");
const pico = doc.eventos.filter(e => /sondeo \d+\)/.test(e.resumen));
ok(pico.length === 160, "pico: 160 peticiones de sondeo");
const nocturna = doc.eventos.filter(e => {
  const t = Number(e.t_ms); if (isNaN(t)) return false;
  const hora = Math.floor((t % 86400000) / 3600000);
  return hora >= 2 && hora < 5 && !/no-existe/.test(e.resumen);
});
ok(nocturna.length >= 100, "actividad nocturna (no IoT) presente (" + nocturna.length + " eventos entre 02:00 y 05:00)");
const atribucion = nocturna.filter(e => e.origen_ip === "192.168.1.22" || e.destino_ip === "192.168.1.22");
ok(atribucion.length >= 20, "las líneas DNS/NAT nocturnas permiten atribuir al sobremesa (" + atribucion.length + ")");
const diurnoResto = doc.eventos.filter(e => {
  const t = Number(e.t_ms); if (isNaN(t)) return false;
  const hora = Math.floor((t % 86400000) / 3600000);
  return hora >= 2 && hora < 5 && e.origen_ip && e.origen_ip.startsWith("192.168.1.") &&
    e.origen_ip !== "192.168.1.22" && e.origen_ip !== "192.168.1.25";
});
ok(diurnoResto.length === 0, "ningún otro equipo (salvo el IoT) tiene actividad de madrugada");

/* 5. restricciones de alcance: solo rangos reservados y .example */
const texto = fs.readFileSync(path.join(DIR, "traza_practica.json"), "utf8") + log.join("\n");
const ips = [...new Set(texto.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g))];
const prefijosPermitidos = ["192.168.1.", "192.0.2.", "198.51.100.", "203.0.113."];
const ipsMalas = ips.filter(ip => !prefijosPermitidos.some(p => ip.startsWith(p)));
ok(ipsMalas.length === 0, "todas las IP (" + ips.length + " distintas) están en rangos reservados" + (ipsMalas.length ? " — MALAS: " + ipsMalas.join(",") : ""));
const dominios = [...new Set(texto.match(/[a-z0-9-]+\.[a-z0-9.-]*[a-z]{2,}/gi))]
  .filter(d => /\.(com|org|net|es|io|gov|edu)\b/i.test(d));
ok(dominios.length === 0, "ningún dominio real (.com/.org/.net/…)" + (dominios.length ? " — ENCONTRADOS: " + dominios.slice(0,5).join(",") : ""));

/* 6. cobertura temporal */
const ts = doc.eventos.map(e => Number(e.t_ms)).filter(t => !isNaN(t));
ok(Math.max(...ts) - Math.min(...ts) > 4 * 86400000, "el conjunto abarca más de 4 días");

console.log("\n" + (fallos === 0 ? "COMPROBACIÓN DE DATOS EN VERDE" : fallos + " comprobaciones fallidas"));
process.exit(fallos ? 1 : 0);
