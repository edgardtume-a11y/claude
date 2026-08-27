/*
 * TRAZA v1.0.0 — generar-datos-practica.js
 * Genera el conjunto de datos sintéticos de práctica (entrega2):
 *   traza_practica.json  — esquema traza.eventos.v1, sucio a nivel de contenido
 *   traza_practica.log   — registro de texto, sucio a nivel estructural
 *   DATOS.md             — documentación (sin revelar anomalías)
 *   SOLUCIONES.md        — hoja de respuestas con líneas exactas
 *
 * HERRAMIENTA DE DESARROLLO: no forma parte del paquete entregado. Solo
 * GENERA datos; no analiza, procesa ni clasifica registros. Determinista
 * (generador congruencial con semilla fija): mismas salidas en cada ejecución.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SALIDA = path.join(__dirname, "..", "entrega2");
fs.mkdirSync(SALIDA, { recursive: true });

/* ---------------- azar determinista ---------------- */
let semilla = 20260817;
function azar() { // generador congruencial lineal clásico
  semilla = (semilla * 1664525 + 1013904223) >>> 0;
  return semilla / 4294967296;
}
function entre(a, b) { return a + Math.floor(azar() * (b - a + 1)); }
function elegir(lista) { return lista[Math.floor(azar() * lista.length)]; }

/* ---------------- constantes del laboratorio ---------------- */
const EPOCA_MS = Date.UTC(2026, 7, 17, 0, 0, 0); // 2026-08-17T00:00:00Z = t_ms 0
const DIA = 24 * 3600 * 1000;
const AVISO =
  "Datos sintéticos generados para practicar la lectura de registros. " +
  "Ninguna medición procede de una red real; direcciones de rangos reservados " +
  "(RFC 5737 / RFC 1918) y dominios .example (RFC 2606).";

const EQUIPOS = [
  { ip: "192.168.1.21", nombre: "portatil" },
  { ip: "192.168.1.22", nombre: "sobremesa" },
  { ip: "192.168.1.23", nombre: "movil" },
  { ip: "192.168.1.24", nombre: "tele" },
  { ip: "192.168.1.26", nombre: "invitado" }
];
const IOT = { ip: "192.168.1.25", nombre: "sensor-iot" };
const ROUTER_WAN = "203.0.113.42";
const RESOLVEDOR = "198.51.100.53";
const ATACANTE = "203.0.113.66"; // origen externo sintético de la ráfaga
const SERVIDORES = {
  "portal.example":   "192.0.2.80",
  "api.example":      "192.0.2.81",
  "archivos.example": "192.0.2.82",
  "correo.example":   "192.0.2.83",
  "acceso.example":   "192.0.2.84",
  "noticias.example": "192.0.2.85"
};
const DOMINIOS = Object.keys(SERVIDORES);
const RUTAS = ["/", "/inicio", "/lista", "/detalle/7", "/detalle/12", "/buscar?q=redes",
  "/adjuntos/informe.pdf", "/api/v1/estado", "/api/v1/elementos", "/imagenes/logo.svg"];

/* ---------------- fabricación de eventos ---------------- */
let contadorEventos = 0;
const eventosBase = []; // {evento, etiquetas:[...]}: etiquetas marcan anomalías de comportamiento

function evento(base, etiquetas) {
  const e = {
    id: null, // se asigna tras ordenar
    t_ms: base.t_ms,
    etapa: base.etapa,
    tipo: base.tipo || "paquete",
    desde: base.desde,
    hasta: base.hasta,
    origen_ip: base.origen_ip || null,
    origen_puerto: base.origen_puerto === undefined ? null : base.origen_puerto,
    destino_ip: base.destino_ip || null,
    destino_puerto: base.destino_puerto === undefined ? null : base.destino_puerto,
    protocolo: base.protocolo || "—",
    tam_bytes: base.tam_bytes === undefined ? null : base.tam_bytes,
    estado: base.estado || "ok",
    resumen: base.resumen,
    detalle: base.detalle,
    nota_aprender: base.nota_aprender || "Tráfico rutinario del laboratorio.",
    sintetico: true
  };
  eventosBase.push({ evento: e, etiquetas: etiquetas || [] });
  return e;
}

/* Sesión de navegación de un equipo hacia un dominio. Devuelve el t final. */
function sesion(equipo, dominio, t, etiquetas, opciones) {
  opciones = opciones || {};
  const servidor = SERVIDORES[dominio];
  const pEfimero = entre(49152, 65535);
  const pNat = entre(40000, 49151);

  if (azar() > 0.35) { // 65 %: la resolución no está en caché
    evento({ t_ms: t, etapa: "dns", desde: "equipo", hasta: "dns",
      origen_ip: equipo.ip, origen_puerto: entre(49152, 65535),
      destino_ip: RESOLVEDOR, destino_puerto: 53, protocolo: "UDP",
      tam_bytes: 60 + dominio.length, estado: "ok",
      resumen: "Consulta DNS A para " + dominio,
      detalle: "consulta DNS tipo A\n  nombre: " + dominio,
      nota_aprender: "Resolución de nombre previa a la conexión." }, etiquetas);
    t += entre(9, 38);
    evento({ t_ms: t, etapa: "dns", desde: "dns", hasta: "equipo",
      origen_ip: RESOLVEDOR, origen_puerto: 53,
      destino_ip: equipo.ip, destino_puerto: 53000, protocolo: "UDP",
      tam_bytes: 76 + dominio.length, estado: "ok",
      resumen: "Respuesta DNS: " + dominio + " = " + servidor,
      detalle: "respuesta DNS\n  " + dominio + " -> " + servidor + "\n  TTL: " + elegir([60, 120, 300, 600]) + " s",
      nota_aprender: "El resolvedor devuelve la dirección del servidor." }, etiquetas);
    t += entre(2, 6);
  }

  evento({ t_ms: t, etapa: "nat", tipo: "estado", desde: "router", hasta: "router",
    origen_ip: equipo.ip, origen_puerto: pEfimero,
    destino_ip: ROUTER_WAN, destino_puerto: pNat, protocolo: "—", tam_bytes: null,
    estado: "info",
    resumen: "Entrada NAT " + equipo.ip + ":" + pEfimero + " -> " + ROUTER_WAN + ":" + pNat,
    detalle: "tabla NAT\n  " + equipo.ip + ":" + pEfimero + " <-> " + ROUTER_WAN + ":" + pNat + " -> " + servidor + ":443",
    nota_aprender: "El router anota la traducción de la nueva conexión." }, etiquetas);
  t += entre(1, 4);

  evento({ t_ms: t, etapa: "tcp", desde: "equipo", hasta: "servidor",
    origen_ip: ROUTER_WAN, origen_puerto: pNat, destino_ip: servidor, destino_puerto: 443,
    protocolo: "TCP", tam_bytes: 60, estado: "ok",
    resumen: "Apretón de manos TCP completado con " + dominio,
    detalle: "SYN -> SYN-ACK -> ACK completados (resumen)",
    nota_aprender: "Conexión fiable establecida." }, etiquetas);
  t += entre(18, 90);

  evento({ t_ms: t, etapa: "tls", desde: "servidor", hasta: "equipo",
    origen_ip: servidor, origen_puerto: 443, destino_ip: ROUTER_WAN, destino_puerto: pNat,
    protocolo: "TLS", tam_bytes: entre(2400, 3400), estado: "ok",
    resumen: "Negociación TLS 1.3 completada (SNI " + dominio + ")",
    detalle: "TLS 1.3 establecido\n  SNI: " + dominio,
    nota_aprender: "Canal cifrado activo." }, etiquetas);
  t += entre(4, 15);

  const nPeticiones = opciones.peticiones || entre(1, 4);
  for (let i = 0; i < nPeticiones; i++) {
    const ruta = opciones.ruta || elegir(RUTAS);
    const metodo = opciones.metodo || "GET";
    evento({ t_ms: t, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
      origen_ip: ROUTER_WAN, origen_puerto: pNat, destino_ip: servidor, destino_puerto: 443,
      protocolo: "HTTP", tam_bytes: entre(320, 720), estado: "ok",
      resumen: metodo + " " + ruta + " hacia " + dominio,
      detalle: metodo + " " + ruta + " HTTP/1.1\nHost: " + dominio,
      nota_aprender: "Petición dentro del túnel cifrado." }, etiquetas);
    t += entre(25, 160);

    let codigo = opciones.codigo;
    if (!codigo) {
      const dado = azar();
      codigo = dado < 0.85 ? 200 : (dado < 0.95 ? 304 : 404);
    }
    const estados = { 200: "ok", 304: "ok", 404: "advertencia", 401: "advertencia", 429: "error" };
    const nombres = { 200: "200 OK", 304: "304 Not Modified (no modificado)",
      404: "404 Not Found (no encontrado)", 401: "401 Unauthorized (no autorizado)",
      429: "429 Too Many Requests (demasiadas peticiones)" };
    evento({ t_ms: t, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
      origen_ip: servidor, origen_puerto: 443, destino_ip: ROUTER_WAN, destino_puerto: pNat,
      protocolo: "HTTP", tam_bytes: codigo === 304 ? entre(180, 260) : entre(400, 18000),
      estado: estados[codigo],
      resumen: "Respuesta " + nombres[codigo] + " de " + dominio + " para " + ruta,
      detalle: "HTTP/1.1 " + nombres[codigo] + "\nHost: " + dominio,
      nota_aprender: opciones.nota || "Respuesta del servidor." }, etiquetas);
    t += entre(40, 900);
  }
  return t;
}

/* -------- 1) tráfico normal: 5 días laborables, horario diurno -------- */
for (let dia = 0; dia < 5; dia++) {
  for (const equipo of EQUIPOS) {
    const nSesiones = entre(6, 12);
    for (let s = 0; s < nSesiones; s++) {
      const hora = entre(7 * 60, 23 * 60 + 30); // 07:00–23:30, en minutos
      const t = dia * DIA + hora * 60000 + entre(0, 59000);
      sesion(equipo, elegir(DOMINIOS), t, []);
    }
  }
}

/* -------- 2) anomalía RAFAGA: fuerza bruta desde un origen externo -------- */
/* miércoles 2026-08-19, 14:12–14:19 UTC, 45 intentos 401 + 429 final       */
{
  let t = 2 * DIA + (14 * 3600 + 12 * 60) * 1000;
  const pOrigen = entre(50000, 60000);
  evento({ t_ms: t, etapa: "tcp", desde: "proveedor", hasta: "servidor",
    origen_ip: ATACANTE, origen_puerto: pOrigen, destino_ip: SERVIDORES["acceso.example"], destino_puerto: 443,
    protocolo: "TCP", tam_bytes: 60, estado: "ok",
    resumen: "Apretón de manos TCP completado con acceso.example (origen externo)",
    detalle: "SYN -> SYN-ACK -> ACK completados (resumen)",
    nota_aprender: "Conexión entrante desde fuera del laboratorio." }, ["rafaga"]);
  t += 40;
  for (let i = 1; i <= 45; i++) {
    evento({ t_ms: t, etapa: "http_solicitud", desde: "proveedor", hasta: "servidor",
      origen_ip: ATACANTE, origen_puerto: pOrigen, destino_ip: SERVIDORES["acceso.example"], destino_puerto: 443,
      protocolo: "HTTP", tam_bytes: entre(430, 470), estado: "ok",
      resumen: "POST /acceso hacia acceso.example (intento " + i + ")",
      detalle: "POST /acceso HTTP/1.1\nHost: acceso.example\n\nusuario=" +
        elegir(["admin", "raiz", "prueba", "estudiante", "operador"]) + "&clave=********",
      nota_aprender: "Intento de inicio de sesión." }, ["rafaga"]);
    t += entre(28, 90);
    const esUltimo = i === 45;
    evento({ t_ms: t, etapa: "http_respuesta", desde: "servidor", hasta: "proveedor",
      origen_ip: SERVIDORES["acceso.example"], origen_puerto: 443, destino_ip: ATACANTE, destino_puerto: pOrigen,
      protocolo: "HTTP", tam_bytes: entre(290, 330),
      estado: esUltimo ? "error" : "advertencia",
      resumen: esUltimo
        ? "Respuesta 429 Too Many Requests (demasiadas peticiones) de acceso.example"
        : "Respuesta 401 Unauthorized (no autorizado) de acceso.example (intento " + i + ")",
      detalle: esUltimo
        ? "HTTP/1.1 429 Too Many Requests\nRetry-After: 600"
        : "HTTP/1.1 401 Unauthorized",
      nota_aprender: esUltimo ? "El servidor aplica limitación de tasa." : "Credenciales rechazadas." }, ["rafaga"]);
    t += entre(120, 900);
  }
  evento({ t_ms: t + 500, etapa: "http_respuesta", tipo: "estado", desde: "servidor", hasta: "servidor",
    origen_ip: null, origen_puerto: null, destino_ip: null, destino_puerto: null,
    protocolo: "—", tam_bytes: null, estado: "advertencia",
    resumen: "acceso.example registra el patrón y bloquea temporalmente el origen " + ATACANTE,
    detalle: "registro del servidor (extracto)\n  45 fallos de acceso desde " + ATACANTE + " en 7 min\n  accion: bloqueo 600 s + alerta",
    nota_aprender: "Reacción defensiva: bloqueo temporal y alerta." }, ["rafaga"]);
}

/* -------- 3) anomalía NOCTURNA: el sobremesa navega de madrugada -------- */
/* noches del 2026-08-18 y 2026-08-20, 02:30–04:10 UTC                      */
for (const dia of [1, 3]) {
  for (let s = 0; s < 6; s++) {
    const t = dia * DIA + (2 * 3600 + 30 * 60) * 1000 + s * entre(12, 17) * 60000;
    sesion(EQUIPOS[1] /* sobremesa */, elegir(["archivos.example", "correo.example"]), t,
      ["nocturna"], { peticiones: entre(2, 4) });
  }
}

/* -------- 4) anomalía NXDOMAIN: el sensor IoT insiste con un dominio roto -------- */
/* del 2026-08-19 12:00 UTC a la tarde del 2026-08-21, una consulta cada 40-50 min: 70 pares */
{
  const dominioRoto = "actualizaciones.no-existe.example";
  let t = 2 * DIA + 12 * 3600 * 1000;
  for (let i = 0; i < 70; i++) {
    evento({ t_ms: t, etapa: "dns", desde: "equipo", hasta: "dns",
      origen_ip: IOT.ip, origen_puerto: entre(49152, 65535),
      destino_ip: RESOLVEDOR, destino_puerto: 53, protocolo: "UDP",
      tam_bytes: 60 + dominioRoto.length, estado: "ok",
      resumen: "Consulta DNS A para " + dominioRoto,
      detalle: "consulta DNS tipo A\n  nombre: " + dominioRoto,
      nota_aprender: "Dispositivo consultando su servidor de actualizaciones." }, ["nxdomain"]);
    t += entre(12, 30);
    evento({ t_ms: t, etapa: "dns", desde: "dns", hasta: "equipo",
      origen_ip: RESOLVEDOR, origen_puerto: 53, destino_ip: IOT.ip, destino_puerto: 53000,
      protocolo: "UDP", tam_bytes: 60 + dominioRoto.length, estado: "error",
      resumen: "Respuesta DNS NXDOMAIN para " + dominioRoto,
      detalle: "respuesta DNS\n  rcode: 3 NXDOMAIN (dominio inexistente)",
      nota_aprender: "El nombre consultado no existe." }, ["nxdomain"]);
    t += entre(40, 50) * 60000 + entre(0, 45000);
  }
}

/* -------- 5) anomalía PICO: el móvil dispara peticiones a la API -------- */
/* jueves 2026-08-20, 20:00–20:10 UTC, 160 pares de petición/respuesta      */
{
  let t = 3 * DIA + 20 * 3600 * 1000;
  const pNat = entre(40000, 49151);
  sesion(EQUIPOS[2] /* movil */, "api.example", t - 4000, ["pico"], { peticiones: 1 });
  for (let i = 0; i < 160; i++) {
    evento({ t_ms: t, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
      origen_ip: ROUTER_WAN, origen_puerto: pNat, destino_ip: SERVIDORES["api.example"], destino_puerto: 443,
      protocolo: "HTTP", tam_bytes: entre(340, 380), estado: "ok",
      resumen: "GET /api/v1/estado hacia api.example (sondeo " + (i + 1) + ")",
      detalle: "GET /api/v1/estado HTTP/1.1\nHost: api.example",
      nota_aprender: "Sondeo repetido de una aplicación." }, ["pico"]);
    t += entre(15, 60);
    evento({ t_ms: t, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
      origen_ip: SERVIDORES["api.example"], origen_puerto: 443, destino_ip: ROUTER_WAN, destino_puerto: pNat,
      protocolo: "HTTP", tam_bytes: entre(210, 260), estado: "ok",
      resumen: "Respuesta 200 OK de api.example para /api/v1/estado",
      detalle: "HTTP/1.1 200 OK\nContent-Type: application/json",
      nota_aprender: "Respuesta breve de estado." }, ["pico"]);
    t += entre(1500, 2600);
  }
}

/* ---------------- ordenar y numerar ---------------- */
eventosBase.sort((a, b) => a.evento.t_ms - b.evento.t_ms);
eventosBase.forEach((par, i) => {
  par.evento.id = "E" + String(i + 1).padStart(4, "0");
});
contadorEventos = eventosBase.length;
console.log("Eventos base generados: " + contadorEventos);
if (contadorEventos < 2000) throw new Error("Se requieren al menos 2000 eventos");

module.exports = { eventosBase, EPOCA_MS, AVISO, azar, entre, elegir, SALIDA };
