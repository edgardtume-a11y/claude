/* Ejecuta las pruebas del núcleo en Node (mismas pruebas que pruebas.html). */
"use strict";
const nucleo = require("../src/nucleo.js");
const pruebas = require("../src/pruebas-def.js");
const resultados = pruebas.ejecutarTodas(nucleo);
let fallos = 0;
for (const r of resultados) {
  const marca = r.paso ? "PASA " : "FALLA";
  if (!r.paso) fallos++;
  console.log(`${marca} [${r.grupo}] ${r.nombre}${r.paso ? "" : "\n      → " + r.error}`);
}
console.log(`\n${resultados.length - fallos}/${resultados.length} pruebas superadas`);
process.exit(fallos === 0 ? 0 : 1);
