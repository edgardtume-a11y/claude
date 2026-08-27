/*
 * TRAZA v1.0.0 — empaquetar-datos-practica.js
 * Toma los eventos base de generar-datos-practica.js, aplica la suciedad
 * deliberada (registrando cada defecto), y escribe:
 *   entrega2/traza_practica.json · traza_practica.log · DATOS.md · SOLUCIONES.md
 * HERRAMIENTA DE DESARROLLO: no se incluye en el paquete entregado.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const g = require("./generar-datos-practica.js");

const { eventosBase, EPOCA_MS, AVISO, SALIDA } = g;
const FECHA_GENERACION = "2026-08-27T00:00:00.000Z"; // fija: salida reproducible

/* ================================================================== */
/* 1) VERSIÓN JSON — válida sintácticamente, sucia a nivel de datos    */
/* ================================================================== */
const eventosJson = eventosBase.map(p => JSON.parse(JSON.stringify(p.evento)));
const defectosJson = [];

function indiceDeId(id) { return eventosJson.findIndex(e => e.id === id); }

/* 1a. cuatro objetos duplicados (copia idéntica justo después del original) */
for (const id of ["E0212", "E0847", "E1633", "E2405"]) {
  const i = indiceDeId(id);
  eventosJson.splice(i + 1, 0, JSON.parse(JSON.stringify(eventosJson[i])));
  defectosJson.push({ tipo: "objeto duplicado", id, detalle: "el evento aparece dos veces seguidas, byte a byte idéntico" });
}
/* 1b. colisión de id: un evento posterior reutiliza un id ajeno */
{
  const i = indiceDeId("E1890");
  eventosJson[i].id = "E0500";
  defectosJson.push({ tipo: "colisión de id", id: "E0500", detalle: "dos eventos distintos comparten id (el segundo era E1890); su t_ms los delata" });
}
/* 1c. tres parejas fuera de orden cronológico (t_ms intercambiados de posición) */
for (const id of ["E0333", "E1210", "E2101"]) {
  const i = indiceDeId(id);
  const [sacado] = eventosJson.splice(i, 1);
  eventosJson.splice(i + 9, 0, sacado); // lo movemos 9 posiciones hacia delante
  defectosJson.push({ tipo: "orden cronológico roto", id, detalle: "el evento está desplazado ~9 posiciones respecto a su t_ms" });
}
/* 1d. campos vacíos */
for (const [id, campo] of [["E0155", "protocolo"], ["E0940", "protocolo"], ["E1777", "protocolo"], ["E0670", "estado"], ["E2240", "estado"]]) {
  eventosJson[indiceDeId(id)][campo] = "";
  defectosJson.push({ tipo: "campo vacío", id, detalle: "el campo «" + campo + "» es una cadena vacía" });
}
/* 1e. un evento sin el campo estado */
{
  delete eventosJson[indiceDeId("E1502")].estado;
  defectosJson.push({ tipo: "campo ausente", id: "E1502", detalle: "el campo «estado» no existe en el objeto" });
}
/* 1f. un t_ms como texto en lugar de número */
{
  const e = eventosJson[indiceDeId("E1099")];
  e.t_ms = String(e.t_ms);
  defectosJson.push({ tipo: "tipo incorrecto", id: "E1099", detalle: "t_ms es una cadena (\"" + e.t_ms + "\") en lugar de un número" });
}
/* 1g. codificación rota en un resumen (primer evento con acentos a partir de E1955) */
{
  let i = indiceDeId("E1955");
  while (!/[óáé]/.test(eventosJson[i].resumen)) i++;
  const e = eventosJson[i];
  e.resumen = e.resumen.replace(/ó/g, "Ã³").replace(/á/g, "Ã¡").replace(/é/g, "Ã©");
  defectosJson.push({ tipo: "codificación rota (mojibake)", id: e.id, detalle: "resumen con UTF-8 doblemente codificado: «" + e.resumen.slice(0, 60) + "…»" });
}

const documentoJson = {
  esquema: "traza.eventos.v1",
  version_app: "1.0.0",
  generado_en: FECHA_GENERACION,
  escenario: "practica-mixta",
  aviso: AVISO,
  campos: ["id","t_ms","etapa","tipo","desde","hasta","origen_ip","origen_puerto","destino_ip","destino_puerto","protocolo","tam_bytes","estado","resumen","detalle","nota_aprender","sintetico"],
  epoca_t0: "2026-08-17T00:00:00.000Z",
  eventos: eventosJson
};
fs.writeFileSync(path.join(SALIDA, "traza_practica.json"), JSON.stringify(documentoJson, null, 1) + "\n");

/* ================================================================== */
/* 2) VERSIÓN .LOG — sucia a nivel estructural                        */
/* ================================================================== */
function rell(t, n) { t = String(t); while (t.length < n) t += " "; return t; }
function rellIzq(t, n) { t = String(t); while (t.length < n) t = " " + t; return t; }
function lineaFormatoA(e, tOverride) {
  const origen = e.origen_ip ? e.origen_ip + ":" + e.origen_puerto : "—";
  const destino = e.destino_ip ? e.destino_ip + ":" + e.destino_puerto : "—";
  const tam = e.tam_bytes === null ? "—" : e.tam_bytes + " B";
  return "[+" + rellIzq(tOverride !== undefined ? tOverride : e.t_ms, 9) + " ms] " +
    rell(e.id, 6) + rell(e.etapa, 16) + rell(e.tipo, 8) + rell(e.protocolo, 5) +
    rell(origen, 21) + "-> " + rell(destino, 21) + rellIzq(tam, 8) + "  " +
    rell(e.estado, 12) + ":: " + e.resumen + " (SINTETICO)";
}
function iso(t_ms) { return new Date(EPOCA_MS + t_ms).toISOString(); }
function lineaFormatoB(e, isoOverride) {
  const origen = e.origen_ip ? e.origen_ip + ":" + e.origen_puerto : "-";
  const destino = e.destino_ip ? e.destino_ip + ":" + e.destino_puerto : "-";
  return [isoOverride || iso(e.t_ms), e.id, e.etapa, e.tipo, e.protocolo, origen, destino,
    e.tam_bytes === null ? "-" : e.tam_bytes, e.estado, e.resumen, "SINTETICO"].join("|");
}

/* objetos-línea con marca; el número de línea final se calcula al terminar */
const lineas = [];
function L(texto, marca, etiquetas) { const o = { texto, marca: marca || null, etiquetas: etiquetas || [] }; lineas.push(o); return o; }

L("# TRAZA v1.0.0 — registro de practica (conjunto sintetico ampliado)");
L("# esquema de referencia: traza.eventos.v1 (formato de linea documentado en DATOS.md)");
L("# escenario: practica-mixta");
L("# generado_en: " + FECHA_GENERACION);
L("# epoca t0: 2026-08-17T00:00:00Z (t_ms 0)");
L("# aviso: " + AVISO);
L("#");
L("# [t_ms] id etapa tipo protocolo origen -> destino tam estado :: resumen");

const CORTE = Math.floor(eventosBase.length * 0.55); // cambio de formato al 55 %
eventosBase.forEach((par, i) => {
  if (i === CORTE) L("# reinicio del recolector de registros", "cambio-formato");
  const e = par.evento;
  L(i < CORTE ? lineaFormatoA(e) : lineaFormatoB(e), null, par.etiquetas);
});

/* --- suciedad estructural (sobre el arreglo de objetos-línea) --- */
const defectosLog = [];
function buscarLineaDeId(id) { return lineas.findIndex(o => o.texto.includes(" " + id + " ") || o.texto.includes("|" + id + "|")); }

/* 2a. seis líneas malformadas insertadas */
const MALFORMADAS = [
  { tras: "E0100", texto: null, corte: 44, detalle: "línea truncada a 44 caracteres (escritura interrumpida)" },
  { tras: "E0450", texto: "[+", detalle: "línea que solo contiene «[+»" },
  { tras: "E0980", texto: "####BLOQUE-DANADO####3f9a71c2e88d4410b6", detalle: "bloque de basura sin estructura" },
  { tras: "E1400", texto: null, sinResumen: true, detalle: "línea de formato A sin separador «::» ni resumen" },
  { tras: "E2000", texto: "2026-08-20T18:44:02.118Z|E????|http_respuesta|paquete|HTTP|192.0.2.81:443", detalle: "línea de formato B con solo 6 de los 11 campos" },
  { tras: "E2300", texto: "{\"id\":\"E2300\",\"t_ms\":3078", detalle: "fragmento de JSON volcado por error dentro del log" }
];
for (const m of MALFORMADAS) {
  const i = buscarLineaDeId(m.tras);
  let texto = m.texto;
  if (texto === null && m.corte) texto = lineas[i].texto.slice(0, m.corte);
  if (texto === null && m.sinResumen) texto = lineas[i].texto.split("::")[0].trimEnd();
  const obj = { texto, marca: "malformada", etiquetas: [], detalle: m.detalle };
  lineas.splice(i + 1, 0, obj);
  defectosLog.push(obj);
}

/* 2b. diez líneas duplicadas: 7 contiguas y 3 alejadas ~40 líneas */
const DUP_CONTIGUAS = ["E0260", "E0610", "E0890", "E1240", "E1680", "E2110", "E2520"];
for (const id of DUP_CONTIGUAS) {
  const i = buscarLineaDeId(id);
  const obj = { texto: lineas[i].texto, marca: "duplicada", etiquetas: [], detalle: "duplicado inmediato de la línea del evento " + id };
  lineas.splice(i + 1, 0, obj);
  defectosLog.push(obj);
}
for (const id of ["E0330", "E1500", "E2360"]) {
  const i = buscarLineaDeId(id);
  const obj = { texto: lineas[i].texto, marca: "duplicada", etiquetas: [], detalle: "duplicado alejado (~40 líneas después) de la línea del evento " + id };
  lineas.splice(Math.min(i + 40, lineas.length), 0, obj);
  defectosLog.push(obj);
}

/* 2c. desorden: un bloque de 12 líneas rotado + 3 parejas adyacentes intercambiadas */
{
  const i = buscarLineaDeId("E0760");
  const bloque = lineas.slice(i, i + 12);
  const rotado = bloque.slice(5).concat(bloque.slice(0, 5)); // rotación de 5
  for (let k = 0; k < 12; k++) lineas[i + k] = rotado[k];
  rotado.forEach(o => { o.marcaOrden = "bloque-rotado"; });
  defectosLog.push({ marca: "desorden", objs: rotado, detalle: "bloque de 12 líneas rotado 5 posiciones (t_ms no monótono)" });
}
for (const id of ["E0520", "E1320", "E2450"]) {
  const i = buscarLineaDeId(id);
  const a = lineas[i], b = lineas[i + 1];
  lineas[i] = b; lineas[i + 1] = a;
  defectosLog.push({ marca: "desorden", objs: [b, a], detalle: "pareja adyacente intercambiada (eventos " + id + " y el siguiente)" });
}

/* 2d. caracteres no ASCII / codificación rota */
for (const id of ["E0700", "E1600", "E2470"]) {
  const i = buscarLineaDeId(id);
  let t = lineas[i].texto.replace(/ó/g, "Ã³").replace(/é/g, "Ã©").replace(/í/g, "Ã­");
  if (!/Ã/.test(t)) t = t.replace("SINTETICO", "SINTÃ‰TICO"); // sin acentos: se rompe la marca final
  lineas[i].texto = t;
  lineas[i].marca = "mojibake";
  defectosLog.push({ marca: "mojibake", objs: [lineas[i]], detalle: "línea del evento " + id + " con UTF-8 doblemente codificado (Ã³, Ã‰…)" });
}
{
  const i = buscarLineaDeId("E1150");
  lineas[i].texto = lineas[i].texto.replace(":: ", ":: �");
  lineas[i].marca = "no-ascii";
  defectosLog.push({ marca: "no-ascii", objs: [lineas[i]], detalle: "línea del evento E1150 con carácter de sustitución U+FFFD (�) al inicio del resumen" });
}
{
  const i = buscarLineaDeId("E1850");
  lineas[i].texto = lineas[i].texto.replace("SINTETICO", "SINTETICO ");
  lineas[i].marca = "no-ascii";
  defectosLog.push({ marca: "no-ascii", objs: [lineas[i]], detalle: "línea del evento E1850 termina en un espacio duro invisible U+00A0" });
}

/* 2e. relojes rotos: un t negativo (formato A) y dos fechas 2036 (formato B) */
{
  const i = buscarLineaDeId("E0840");
  const obj = { texto: lineaFormatoA(eventosBase[839].evento, -1840), marca: "reloj", etiquetas: [], detalle: "línea con instante negativo [+ -1840 ms] (reloj retrasado)" };
  lineas.splice(i + 1, 0, obj);
  defectosLog.push(obj);
}
for (const id of ["E2050", "E2600"]) {
  const i = buscarLineaDeId(id);
  lineas[i].texto = lineas[i].texto.replace(/^2026-/, "2036-");
  lineas[i].marca = "reloj";
  defectosLog.push({ marca: "reloj", objs: [lineas[i]], detalle: "línea del evento " + id + " fechada en 2036 (reloj adelantado diez años)" });
}

/* 2f. dos líneas de formato B con el campo estado vacío */
for (const id of ["E2150", "E2700"]) {
  const i = buscarLineaDeId(id);
  const partes = lineas[i].texto.split("|");
  if (partes.length === 11) { partes[8] = ""; lineas[i].texto = partes.join("|"); }
  lineas[i].marca = "campo-vacio";
  defectosLog.push({ marca: "campo-vacio", objs: [lineas[i]], detalle: "línea del evento " + id + " con el campo estado vacío (||)" });
}

/* --- números de línea finales --- */
const numeroDe = new Map();
lineas.forEach((o, i) => numeroDe.set(o, i + 1));
fs.writeFileSync(path.join(SALIDA, "traza_practica.log"),
  lineas.map(o => o.texto).join("\n") + "\n");

/* rangos de línea por anomalía de comportamiento */
function rangoEtiqueta(nombre) {
  const nums = lineas.filter(o => o.etiquetas.includes(nombre)).map(o => numeroDe.get(o));
  return { desde: Math.min(...nums), hasta: Math.max(...nums), n: nums.length };
}
const rangos = { rafaga: rangoEtiqueta("rafaga"), nocturna: rangoEtiqueta("nocturna"),
  nxdomain: rangoEtiqueta("nxdomain"), pico: rangoEtiqueta("pico") };
const lineaCorte = numeroDe.get(lineas.find(o => o.marca === "cambio-formato"));

/* ================================================================== */
/* 3) SOLUCIONES.md — hoja de respuestas                               */
/* ================================================================== */
function listarLineas(defs) {
  return defs.map(d => {
    if (d.objs) return "- Líneas " + d.objs.map(o => numeroDe.get(o)).join(", ") + " — " + d.detalle;
    return "- Línea " + numeroDe.get(d) + " — " + d.detalle;
  }).join("\n");
}
const idsNocturna = eventosBase.filter(p => p.etiquetas.includes("nocturna")).map(p => p.evento.id);
const idsRafaga = eventosBase.filter(p => p.etiquetas.includes("rafaga")).map(p => p.evento.id);
const idsNx = eventosBase.filter(p => p.etiquetas.includes("nxdomain")).map(p => p.evento.id);
const idsPico = eventosBase.filter(p => p.etiquetas.includes("pico")).map(p => p.evento.id);

const soluciones = `# SOLUCIONES — hoja de respuestas del conjunto de práctica TRAZA v1.0.0

**Este archivo revela todas las anomalías plantadas.** Va aparte a propósito: no lo leas
hasta haber intentado el análisis. Los números de línea se refieren a
\`traza_practica.log\` tal como se entrega (contando desde 1, cabecera incluida); los
identificadores de evento valen para las dos versiones.

Todo el conjunto es sintético (rangos RFC 5737 / RFC 1918, dominios .example).

---

## 1 · Patrones de comportamiento que había que detectar

### 1.1 Ráfaga de intentos de acceso fallidos (fuerza bruta)
- **Cuándo**: miércoles 2026-08-19, 14:12–14:19 UTC (~7 minutos).
- **Qué**: 45 \`POST /acceso\` hacia \`acceso.example\` (192.0.2.84) desde el origen
  externo **203.0.113.66**, con 44 respuestas \`401\` y una \`429\` final con
  \`Retry-After: 600\`, seguida del evento de estado del servidor (bloqueo y alerta).
- **Dónde**: eventos ${idsRafaga[0]}–${idsRafaga[idsRafaga.length - 1]} (${idsRafaga.length} eventos);
  en el log, líneas ${rangos.rafaga.desde}–${rangos.rafaga.hasta}.
- **Cómo se detecta**: filtrar por origen 203.0.113.66 o por resumen «401»; contar
  fallos por origen y ventana de tiempo; nombres de usuario rotando (admin, raiz…).

### 1.2 Actividad en horario inusual
- **Cuándo**: madrugadas del martes 2026-08-18 y del jueves 2026-08-20, 02:30–04:10 UTC.
- **Qué**: 12 sesiones de navegación del equipo **sobremesa (192.168.1.22)** hacia
  \`archivos.example\` y \`correo.example\`, cuando todo el resto del tráfico del
  laboratorio ocurre entre las 07:00 y las 23:30.
- **Dónde**: ${idsNocturna.length} eventos entre ${idsNocturna[0]} y ${idsNocturna[idsNocturna.length - 1]};
  en el log, entre las líneas ${rangos.nocturna.desde} y ${rangos.nocturna.hasta} (en dos bloques, uno por noche).
- **Cómo se detecta**: convertir t_ms a hora del día (época t0 = 2026-08-17T00:00Z) y
  mirar la distribución horaria. Ojo: tras el NAT la mayoría de líneas muestran el origen
  203.0.113.42; la atribución al sobremesa sale de las líneas DNS y NAT de cada sesión,
  que sí conservan 192.168.1.22.

### 1.3 Errores de resolución repetidos
- **Cuándo**: desde el 2026-08-19 12:00 UTC hasta la tarde del viernes 2026-08-21, una consulta cada 40–50 minutos, día y noche.
- **Qué**: el dispositivo **sensor-iot (192.168.1.25)** consulta una y otra vez
  \`actualizaciones.no-existe.example\` y recibe **70 respuestas NXDOMAIN** (140 eventos
  en total). Patrón típico de un dispositivo mal configurado u obsoleto.
- **Dónde**: eventos entre ${idsNx[0]} y ${idsNx[idsNx.length - 1]}; en el log, entre las líneas
  ${rangos.nxdomain.desde} y ${rangos.nxdomain.hasta} (intercalados con el tráfico normal).
- **Cómo se detecta**: agrupar respuestas DNS con estado \`error\`; un mismo nombre
  fallando decenas de veces desde el mismo origen.

### 1.4 Pico de peticiones
- **Cuándo**: jueves 2026-08-20, 20:00–20:10 UTC (~10 minutos).
- **Qué**: el equipo **movil (192.168.1.23)** lanza **160 pares** de
  \`GET /api/v1/estado\` contra \`api.example\` (192.0.2.81), unas 16 peticiones/minuto
  sostenidas: una aplicación sondeando sin control. Todas responden 200.
- **Dónde**: ${idsPico.length} eventos entre ${idsPico[0]} y ${idsPico[idsPico.length - 1]}; en el log,
  líneas ${rangos.pico.desde}–${rangos.pico.hasta}.
- **Cómo se detecta**: histograma de eventos por minuto; el pico multiplica varias veces
  la tasa base del resto del registro.

## 2 · Suciedad estructural plantada en \`traza_practica.log\`

### 2.1 Cambio de formato a mitad del archivo
- **Línea ${lineaCorte}**: aparece \`# reinicio del recolector de registros\` y desde la
  línea siguiente el formato cambia del formato A (\`[+ t_ms ms] … :: resumen\`) al
  formato B (11 campos separados por \`|\` con fecha ISO 8601). Nada lo vuelve a avisar.

### 2.2 Líneas malformadas (6)
${listarLineas(defectosLog.filter(d => d.marca === "malformada"))}

### 2.3 Líneas duplicadas (10)
${listarLineas(defectosLog.filter(d => d.marca === "duplicada"))}

### 2.4 Marcas de tiempo desordenadas
${listarLineas(defectosLog.filter(d => d.marca === "desorden"))}

### 2.5 Caracteres no ASCII / codificación rota
${listarLineas(defectosLog.filter(d => d.marca === "mojibake" || d.marca === "no-ascii"))}

### 2.6 Relojes rotos
${listarLineas(defectosLog.filter(d => d.marca === "reloj"))}

### 2.7 Campos vacíos en formato B
${listarLineas(defectosLog.filter(d => d.marca === "campo-vacio"))}

## 3 · Suciedad de contenido plantada en \`traza_practica.json\`

El JSON es sintácticamente válido (se puede cargar con cualquier lector de JSON), pero
sus datos contienen estos defectos:

${defectosJson.map(d => "- **" + d.tipo + "** — evento " + d.id + ": " + d.detalle).join("\n")}

## 4 · Relación entre las dos versiones

Ambos archivos proceden del mismo registro base de ${eventosBase.length} eventos. La
versión JSON recibió la suciedad de contenido del punto 3; la versión .log, la suciedad
estructural del punto 2. Por tanto **ninguna de las dos copias es totalmente fiel** y no
coinciden exactamente entre sí: comparar ambas es, en sí mismo, un ejercicio.
`;
fs.writeFileSync(path.join(SALIDA, "SOLUCIONES.md"), soluciones);

/* ================================================================== */
/* 4) DATOS.md — documentación sin revelar anomalías                   */
/* ================================================================== */
const totalLog = lineas.length;
const datos = `# DATOS — conjunto sintético de práctica TRAZA v1.0.0

Material de práctica para aprender a **leer y procesar registros** (*logs*: bitácoras).
Complementa al laboratorio TRAZA: mismo esquema de eventos, pero un volumen mucho mayor
y varios días de actividad de una pequeña red doméstica de laboratorio.

> **Todo es sintético.** Direcciones solo de rangos reservados para documentación y
> redes privadas (RFC 5737 y RFC 1918), dominios del TLD reservado \`.example\`
> (RFC 2606). Ninguna dirección, dominio, persona ni entidad real. Ninguna medición
> procede de una red real.

> **Advertencia honesta**: como los registros reales, estos archivos están *sucios*.
> Contienen defectos deliberados de formato y de contenido, además de varios episodios
> de actividad que merece la pena detectar. Parte del ejercicio es encontrarlos. La hoja
> de respuestas completa está en \`SOLUCIONES.md\`: no la leas antes de intentarlo.

## Archivos

| Archivo | Contenido |
| --- | --- |
| \`traza_practica.json\` | ${eventosJson.length} objetos de evento bajo el esquema \`traza.eventos.v1\` (documento JSON válido) |
| \`traza_practica.log\` | ${totalLog} líneas de registro en texto plano (cabeceras \`#\` incluidas) |
| \`DATOS.md\` | Este documento |
| \`SOLUCIONES.md\` | Hoja de respuestas (aparte a propósito) |

Ambos archivos describen el **mismo periodo**: cinco días, del lunes 2026-08-17 al
viernes 2026-08-21 (UTC). El instante \`t_ms\` cuenta milisegundos desde la época
**t0 = 2026-08-17T00:00:00Z** (así, por ejemplo, t_ms 86 400 000 = medianoche del día 2).

## El escenario

Una red doméstica de laboratorio con seis dispositivos —portatil (192.168.1.21),
sobremesa (.22), movil (.23), tele (.24), sensor-iot (.25) e invitado (.26)— detrás de
un router con dirección pública 203.0.113.42, usando el resolvedor DNS 198.51.100.53 y
visitando seis servicios del propio laboratorio (\`portal.example\`, \`api.example\`,
\`archivos.example\`, \`correo.example\`, \`acceso.example\`, \`noticias.example\`, en
192.0.2.80–85). El colector también registra el tráfico que llega a esos servidores
desde fuera de la red (campo \`desde\` = \`proveedor\`).

La mayor parte del registro es navegación normal en horario diurno. El resto… es lo que
hay que encontrar.

## Campos de cada evento (versión JSON)

Mismo esquema \`traza.eventos.v1\` del laboratorio TRAZA:

| Campo | Tipo | Significado |
| --- | --- | --- |
| \`id\` | texto | Identificador del evento (\`E0001\`…), asignado en orden cronológico |
| \`t_ms\` | número | Milisegundos simulados desde t0 (2026-08-17T00:00Z) |
| \`etapa\` | texto | \`dns\` · \`nat\` · \`tcp\` · \`tls\` · \`http_solicitud\` · \`http_respuesta\` |
| \`tipo\` | texto | \`paquete\` (algo viaja) o \`estado\` (algo cambia en un nodo) |
| \`desde\`, \`hasta\` | texto | \`equipo\` · \`router\` · \`dns\` · \`proveedor\` · \`servidor\` |
| \`origen_ip\`, \`origen_puerto\` | texto/número o \`null\` | Origen del paquete |
| \`destino_ip\`, \`destino_puerto\` | texto/número o \`null\` | Destino del paquete |
| \`protocolo\` | texto | \`UDP\` · \`TCP\` · \`TLS\` · \`HTTP\` · \`—\` |
| \`tam_bytes\` | número o \`null\` | Tamaño simulado del mensaje |
| \`estado\` | texto | \`ok\` · \`info\` · \`advertencia\` · \`error\` |
| \`resumen\` | texto | Qué ocurre, en una línea |
| \`detalle\` | texto | Evidencia sintética abreviada |
| \`nota_aprender\` | texto | Nota didáctica breve |
| \`sintetico\` | booleano | Siempre \`true\` |

El documento envolvente añade \`esquema\`, \`version_app\`, \`generado_en\`,
\`escenario\` (\`practica-mixta\`), \`aviso\`, \`campos\` y \`epoca_t0\`.

## Formato de línea del registro \`.log\`

Cabecera de líneas \`#\` y después, en el **formato documentado**, una línea por evento:

\`\`\`
[+     t_ms ms] id  etapa  tipo  protocolo  origen -> destino  tam  estado  :: resumen (SINTETICO)
\`\`\`

con \`origen\`/\`destino\` como \`ip:puerto\` (o \`—\`) y \`tam\` en bytes. Igual que en
los registros reales, **no se garantiza que todas las líneas del archivo cumplan el
formato documentado**: tratar las desviaciones forma parte de la práctica.

## Ideas de práctica (sin herramientas incluidas)

Este paquete entrega **solo datos y documentación** — deliberadamente no incluye ningún
programa de análisis. Ejercicios sugeridos, con la herramienta que cada cual prefiera:

1. Validar el archivo: ¿cuántas líneas cumplen el formato documentado? ¿Qué se hace con
   las que no?
2. Reconstruir la línea de tiempo por dispositivo y por hora del día.
3. Contar respuestas por código y por origen; buscar concentraciones llamativas.
4. Contrastar la versión JSON con la versión .log: ¿coinciden?
5. Escribir un pequeño informe de hallazgos y compararlo después con \`SOLUCIONES.md\`.
`;
fs.writeFileSync(path.join(SALIDA, "DATOS.md"), datos);

/* ================================================================== */
/* 5) autocomprobaciones                                            */
/* ================================================================== */
const doc = JSON.parse(fs.readFileSync(path.join(SALIDA, "traza_practica.json"), "utf8"));
console.log("JSON válido: " + doc.eventos.length + " eventos (>=2000: " + (doc.eventos.length >= 2000) + ")");
const cuerpoLog = fs.readFileSync(path.join(SALIDA, "traza_practica.log"), "utf8").split("\n");
console.log("LOG: " + (cuerpoLog.length - 1) + " líneas; corte de formato en la línea " + lineaCorte);
console.log("Defectos log registrados: " + defectosLog.length + " · defectos json: " + defectosJson.length);
