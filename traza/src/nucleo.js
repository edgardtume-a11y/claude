/*
 * TRAZA v1.0.0 — nucleo.js
 * Núcleo puro de la simulación: datos sintéticos, etapas, escenarios,
 * reproductor (máquina de estados), exportadores y retos.
 *
 * Este módulo NO toca el DOM, NO usa temporizadores y NO realiza ninguna
 * petición de red. Todas sus funciones son puras: reciben datos y devuelven
 * datos nuevos. Así el mismo código se prueba en pruebas.html y se usa en
 * traza.html sin divergencias.
 *
 * TODO DATO AQUÍ ES SINTÉTICO (inventado para la enseñanza). Las direcciones
 * usan rangos reservados para documentación (RFC 5737) y redes privadas
 * (RFC 1918); el dominio usa el TLD reservado ".example" (RFC 2606).
 */
(function (raiz, fabrica) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = fabrica(); // entorno Node (solo para construir y probar)
  } else {
    raiz.TRAZA_NUCLEO = fabrica(); // entorno navegador
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  /* ------------------------------------------------------------------ */
  /* Esquema estable de exportación (documentado en LEEME.md).           */
  /* Si cambia la lista de campos, debe cambiar el nombre del esquema.   */
  /* ------------------------------------------------------------------ */
  var ESQUEMA_EVENTOS = "traza.eventos.v1";
  var CAMPOS_EVENTO = [
    "id",            // identificador estable del evento, p. ej. "E01"
    "t_ms",          // instante SIMULADO en milisegundos desde el inicio
    "etapa",         // clave de etapa: dns | nat | tcp | tls | http_solicitud | http_respuesta
    "tipo",          // "paquete" (algo viaja) o "estado" (algo cambia en un nodo)
    "desde",         // clave del nodo de partida (equipo, router, dns, proveedor, servidor)
    "hasta",         // clave del nodo de llegada
    "origen_ip",     // IP de origen del paquete (sintética)
    "origen_puerto", // puerto de origen (número o null)
    "destino_ip",    // IP de destino del paquete (sintética)
    "destino_puerto",// puerto de destino (número o null)
    "protocolo",     // UDP | TCP | TLS | HTTP | —
    "tam_bytes",     // tamaño SIMULADO del mensaje en bytes (número o null)
    "estado",        // ok | info | advertencia | error
    "resumen",       // una línea: qué ocurre
    "detalle",       // evidencia sintética: contenido plausible del mensaje
    "nota_aprender", // explicación gradual para el modo APRENDER
    "sintetico"      // siempre true: marca de dato inventado para el laboratorio
  ];

  var AVISO_SINTETICO =
    "Datos sintéticos generados por TRAZA con fines educativos. " +
    "Ninguna medición procede de una red real; no se realizó conexión alguna.";

  /* ------------------------------------------------------------------ */
  /* Nodos del recorrido (en el orden visual del lienzo).                */
  /* ------------------------------------------------------------------ */
  var NODOS = [
    { clave: "equipo",    nombre: "Equipo",    descripcion: "Tu ordenador doméstico. Aquí vive el navegador (browser: programa para visitar páginas web)." },
    { clave: "router",    nombre: "Router",    descripcion: "Encaminador doméstico. Une tu red local con internet y aplica NAT (Network Address Translation: traducción de direcciones de red)." },
    { clave: "dns",       nombre: "Resolvedor DNS", descripcion: "Servidor DNS (Domain Name System: sistema de nombres de dominio) del proveedor. Convierte nombres en direcciones IP." },
    { clave: "proveedor", nombre: "Proveedor", descripcion: "ISP (Internet Service Provider: proveedor de servicios de internet). Transporta tus paquetes hasta la red de destino." },
    { clave: "servidor",  nombre: "Servidor web", descripcion: "Máquina remota que aloja la página. Escucha en el puerto 443 (HTTPS: HTTP seguro sobre TLS)." }
  ];

  /* ------------------------------------------------------------------ */
  /* Direcciones sintéticas fijas del laboratorio.                       */
  /* Cada entrada declara su procedencia; no hay ningún cálculo ni       */
  /* clasificación de direcciones en el código: son literales fijos.     */
  /* ------------------------------------------------------------------ */
  var DIRECCIONES = {
    equipo_lan:  { ip: "192.168.1.23",  fuente: "Rango de red doméstica reservado (RFC 1918). Valor concreto: sintético." },
    router_lan:  { ip: "192.168.1.1",   fuente: "Rango de red doméstica reservado (RFC 1918). Valor concreto: sintético." },
    router_wan:  { ip: "203.0.113.42",  fuente: "Rango reservado para documentación TEST-NET-3 (RFC 5737). Valor concreto: sintético." },
    resolvedor:  { ip: "198.51.100.53", fuente: "Rango reservado para documentación TEST-NET-2 (RFC 5737). Valor concreto: sintético." },
    servidor:    { ip: "192.0.2.80",    fuente: "Rango reservado para documentación TEST-NET-1 (RFC 5737). Valor concreto: sintético." }
  };

  var DOMINIO = "laboratorio.example";           // TLD ".example" reservado (RFC 2606)
  var DOMINIO_INEXISTENTE = "no-existe.example"; // también reservado; nunca resolverá en la realidad

  /* ------------------------------------------------------------------ */
  /* Etapas del viaje.                                                   */
  /* ------------------------------------------------------------------ */
  var ETAPAS = [
    {
      clave: "dns",
      nombre: "Resolución DNS",
      termino_en: "DNS (Domain Name System)",
      termino_es: "sistema de nombres de dominio",
      explicacion:
        "Antes de conectar, el equipo necesita traducir el nombre escrito (laboratorio.example) " +
        "a una dirección IP (Internet Protocol: protocolo de internet), que es el número con el que " +
        "se encaminan los paquetes. El navegador pregunta al resolvedor DNS del proveedor y este " +
        "responde con la dirección, o con un error si el nombre no existe.",
      fuente: "Hecho documentado: RFC 1034 y RFC 1035 definen el DNS. Los valores mostrados: simulación."
    },
    {
      clave: "nat",
      nombre: "Traducción NAT",
      termino_en: "NAT (Network Address Translation)",
      termino_es: "traducción de direcciones de red",
      explicacion:
        "Tu equipo usa una dirección privada que no es válida en internet. El router la sustituye " +
        "por su propia dirección pública y anota el cambio en una tabla, para poder devolver las " +
        "respuestas al equipo correcto. Cambian la IP de origen y el puerto de origen del paquete.",
      fuente: "Hecho documentado: RFC 2663 y RFC 3022 describen NAT. La tabla mostrada: simulación."
    },
    {
      clave: "tcp",
      nombre: "Conexión TCP",
      termino_en: "TCP (Transmission Control Protocol)",
      termino_es: "protocolo de control de transmisión",
      explicacion:
        "TCP establece una conexión fiable con un apretón de manos en tres pasos (three-way handshake): " +
        "SYN (synchronize: sincronizar), SYN-ACK y ACK (acknowledgement: acuse de recibo). Ambos " +
        "extremos acuerdan números de secuencia para detectar pérdidas y ordenar los datos.",
      fuente: "Hecho documentado: RFC 9293 define TCP. Números de secuencia mostrados: simulación."
    },
    {
      clave: "tls",
      nombre: "Negociación TLS",
      termino_en: "TLS (Transport Layer Security)",
      termino_es: "seguridad de la capa de transporte",
      explicacion:
        "TLS cifra la conversación. En la negociación (handshake: apretón de manos) el cliente propone " +
        "opciones (ClientHello), el servidor elige y demuestra su identidad con un certificado, y ambos " +
        "derivan claves de sesión. TLS protege el contenido, pero no oculta a quién te conectas.",
      fuente: "Hecho documentado: RFC 8446 define TLS 1.3. La negociación se muestra simplificada: simulación."
    },
    {
      clave: "http_solicitud",
      nombre: "Petición HTTP",
      termino_en: "HTTP (HyperText Transfer Protocol)",
      termino_es: "protocolo de transferencia de hipertexto",
      explicacion:
        "Con el túnel cifrado listo, el navegador envía la petición: método GET, ruta, y cabeceras " +
        "(headers: líneas de metadatos como Host o User-Agent). En la red viaja cifrada; aquí se " +
        "muestra descifrada solo para poder estudiarla.",
      fuente: "Hecho documentado: RFC 9110 define la semántica de HTTP. La petición mostrada: simulación."
    },
    {
      clave: "http_respuesta",
      nombre: "Respuesta HTTP",
      termino_en: "HTTP response",
      termino_es: "respuesta HTTP",
      explicacion:
        "El servidor contesta con un código de estado (200 OK: correcto; 401: no autorizado; " +
        "404: no encontrado; 429: demasiadas peticiones), cabeceras y, si procede, el cuerpo con el " +
        "HTML de la página. El navegador lo interpreta y dibuja la página.",
      fuente: "Hecho documentado: RFC 9110 define los códigos de estado. La respuesta mostrada: simulación."
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Glosario: cada término inglés con traducción y definición breve.    */
  /* ------------------------------------------------------------------ */
  var GLOSARIO = [
    { en: "browser", es: "navegador", definicion: "Programa que pide, recibe y dibuja páginas web.", fuente: "definición general" },
    { en: "packet", es: "paquete", definicion: "Bloque pequeño de datos con cabeceras de origen y destino; internet trocea todo en paquetes.", fuente: "definición general" },
    { en: "IP (Internet Protocol)", es: "protocolo de internet", definicion: "Reglas de direccionamiento y encaminamiento; una dirección IP identifica un extremo.", fuente: "RFC 791" },
    { en: "port", es: "puerto", definicion: "Número (0–65535) que distingue servicios dentro de una misma máquina; 53 DNS, 443 HTTPS.", fuente: "definición general" },
    { en: "DNS (Domain Name System)", es: "sistema de nombres de dominio", definicion: "Directorio distribuido que traduce nombres a direcciones IP.", fuente: "RFC 1034 / RFC 1035" },
    { en: "NXDOMAIN (non-existent domain)", es: "dominio inexistente", definicion: "Respuesta DNS que indica que el nombre consultado no existe.", fuente: "RFC 2308" },
    { en: "NAT (Network Address Translation)", es: "traducción de direcciones de red", definicion: "Sustitución de direcciones/puertos en el router para compartir una dirección pública.", fuente: "RFC 2663 / RFC 3022" },
    { en: "TCP (Transmission Control Protocol)", es: "protocolo de control de transmisión", definicion: "Transporte fiable y ordenado sobre IP; usa conexiones.", fuente: "RFC 9293" },
    { en: "handshake", es: "apretón de manos", definicion: "Intercambio inicial de mensajes para acordar parámetros antes de enviar datos.", fuente: "RFC 9293 / RFC 8446" },
    { en: "SYN / ACK (synchronize / acknowledgement)", es: "sincronizar / acuse de recibo", definicion: "Banderas TCP usadas en el apretón de manos en tres pasos.", fuente: "RFC 9293" },
    { en: "TLS (Transport Layer Security)", es: "seguridad de la capa de transporte", definicion: "Protocolo que cifra y autentica la conexión; la S de HTTPS.", fuente: "RFC 8446" },
    { en: "certificate", es: "certificado", definicion: "Documento firmado que liga un nombre de dominio a una clave pública para probar identidad.", fuente: "RFC 5280" },
    { en: "HTTP (HyperText Transfer Protocol)", es: "protocolo de transferencia de hipertexto", definicion: "Reglas de petición y respuesta entre navegador y servidor web.", fuente: "RFC 9110" },
    { en: "header", es: "cabecera", definicion: "Línea de metadatos en una petición o respuesta (Host, Content-Type…).", fuente: "RFC 9110" },
    { en: "ISP (Internet Service Provider)", es: "proveedor de servicios de internet", definicion: "Empresa que te da acceso a internet y transporta tus paquetes.", fuente: "definición general" },
    { en: "rate limiting", es: "limitación de tasa", definicion: "Defensa del servidor: rechazar temporalmente a quien hace demasiadas peticiones o intentos.", fuente: "RFC 6585 (código 429)" },
    { en: "RTT (round-trip time)", es: "tiempo de ida y vuelta", definicion: "Lo que tarda un mensaje en ir al destino y volver.", fuente: "definición general" }
  ];

  /* ------------------------------------------------------------------ */
  /* Utilidad interna para fabricar eventos con valores por defecto.     */
  /* ------------------------------------------------------------------ */
  function evento(base) {
    var e = {
      id: base.id,
      t_ms: base.t_ms,
      etapa: base.etapa,
      tipo: base.tipo || "paquete",
      desde: base.desde,
      hasta: base.hasta,
      origen_ip: base.origen_ip || null,
      origen_puerto: (base.origen_puerto === undefined) ? null : base.origen_puerto,
      destino_ip: base.destino_ip || null,
      destino_puerto: (base.destino_puerto === undefined) ? null : base.destino_puerto,
      protocolo: base.protocolo || "—",
      tam_bytes: (base.tam_bytes === undefined) ? null : base.tam_bytes,
      estado: base.estado || "ok",
      resumen: base.resumen,
      detalle: base.detalle,
      nota_aprender: base.nota_aprender,
      sintetico: true
    };
    return e;
  }

  var EQ = DIRECCIONES.equipo_lan.ip;
  var RL = DIRECCIONES.router_lan.ip;
  var RW = DIRECCIONES.router_wan.ip;
  var DN = DIRECCIONES.resolvedor.ip;
  var SV = DIRECCIONES.servidor.ip;

  /* Puertos efímeros sintéticos elegidos a mano (no se calculan). */
  var P_DNS_EQ = 51324;   // puerto de origen de la consulta DNS en el equipo
  var P_TCP_EQ = 51402;   // puerto de origen TCP en el equipo
  var P_TCP_NAT = 40817;  // puerto asignado por el router tras la traducción

  /* ------------------------------------------------------------------ */
  /* Escenario 1: navegación normal (las seis etapas completas).         */
  /* ------------------------------------------------------------------ */
  function eventosNormal() {
    return [
      evento({ id: "E01", t_ms: 0, etapa: "dns", desde: "equipo", hasta: "dns",
        origen_ip: EQ, origen_puerto: P_DNS_EQ, destino_ip: DN, destino_puerto: 53,
        protocolo: "UDP", tam_bytes: 74, estado: "ok",
        resumen: "Consulta DNS: ¿qué IP tiene " + DOMINIO + "?",
        detalle: "consulta DNS tipo A\n  nombre: " + DOMINIO + "\n  clase: IN\n  id-transaccion: 0x4a2f\n  banderas: RD (recursion desired: se pide recursión)",
        nota_aprender: "El equipo no sabe dónde vive “" + DOMINIO + "”. Envía una pregunta al resolvedor DNS del proveedor usando UDP (User Datagram Protocol: protocolo de datagramas de usuario), que es rápido y no necesita conexión previa. La pregunta cruza el router de casa." }),
      evento({ id: "E02", t_ms: 18, etapa: "dns", desde: "dns", hasta: "equipo",
        origen_ip: DN, origen_puerto: 53, destino_ip: EQ, destino_puerto: P_DNS_EQ,
        protocolo: "UDP", tam_bytes: 90, estado: "ok",
        resumen: "Respuesta DNS: " + DOMINIO + " = " + SV,
        detalle: "respuesta DNS\n  nombre: " + DOMINIO + "\n  tipo: A\n  TTL: 300 s (time to live: tiempo de vida en caché)\n  direccion: " + SV,
        nota_aprender: "El resolvedor contesta: la dirección es " + SV + ". El equipo la guardará en caché 300 segundos para no volver a preguntar enseguida. Ya se puede conectar." }),
      evento({ id: "E03", t_ms: 24, etapa: "nat", tipo: "estado", desde: "router", hasta: "router",
        origen_ip: EQ, origen_puerto: P_TCP_EQ, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "—", tam_bytes: null, estado: "info",
        resumen: "El router crea una entrada NAT para la nueva conexión",
        detalle: "tabla NAT (nueva entrada)\n  interna:  " + EQ + ":" + P_TCP_EQ + "\n  externa:  " + RW + ":" + P_TCP_NAT + "\n  destino:  " + SV + ":443\n  protocolo: TCP",
        nota_aprender: "La dirección " + EQ + " es privada: solo vale dentro de casa. El router apunta en su tabla “lo que salga por aquí con este puerto es del equipo” y reescribe el origen del paquete con su dirección pública " + RW + "." }),
      evento({ id: "E04", t_ms: 26, etapa: "tcp", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "TCP", tam_bytes: 60, estado: "ok",
        resumen: "TCP SYN: el equipo pide abrir conexión",
        detalle: "segmento TCP\n  banderas: SYN\n  seq: 1183002\n  ventana: 64240\n  opciones: MSS=1460 (maximum segment size: tamaño máximo de segmento)",
        nota_aprender: "Primer paso del apretón de manos: SYN (synchronize: sincronizar). El equipo propone un número de secuencia inicial. Observa que, tras el NAT, el origen que ve internet es " + RW + ":" + P_TCP_NAT + "." }),
      evento({ id: "E05", t_ms: 58, etapa: "tcp", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "TCP", tam_bytes: 60, estado: "ok",
        resumen: "TCP SYN-ACK: el servidor acepta",
        detalle: "segmento TCP\n  banderas: SYN, ACK\n  seq: 774411\n  ack: 1183003",
        nota_aprender: "Segundo paso: el servidor responde SYN-ACK. Acusa recibo (ack = seq del equipo + 1) y propone su propio número de secuencia. El router deshace la traducción NAT y entrega el paquete al equipo." }),
      evento({ id: "E06", t_ms: 60, etapa: "tcp", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "TCP", tam_bytes: 52, estado: "ok",
        resumen: "TCP ACK: conexión establecida",
        detalle: "segmento TCP\n  banderas: ACK\n  seq: 1183003\n  ack: 774412",
        nota_aprender: "Tercer paso: el equipo confirma. La conexión queda ESTABLISHED (establecida) en ambos extremos: ya hay un canal fiable y ordenado por el que enviar datos." }),
      evento({ id: "E07", t_ms: 62, etapa: "tls", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "TLS", tam_bytes: 517, estado: "ok",
        resumen: "TLS ClientHello: el navegador propone cifrados",
        detalle: "TLS 1.3 ClientHello\n  SNI: " + DOMINIO + " (server name indication: indicación del nombre del servidor)\n  suites: TLS_AES_128_GCM_SHA256, TLS_CHACHA20_POLY1305_SHA256\n  key_share: x25519",
        nota_aprender: "Empieza la negociación TLS. El navegador dice qué algoritmos sabe usar y a qué dominio quiere hablar (SNI). Detalle importante: el SNI viaja legible, así que un observador puede saber A QUÉ sitio te conectas aunque no QUÉ haces dentro." }),
      evento({ id: "E08", t_ms: 96, etapa: "tls", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "TLS", tam_bytes: 2890, estado: "ok",
        resumen: "TLS ServerHello + certificado",
        detalle: "TLS 1.3 ServerHello\n  suite elegida: TLS_AES_128_GCM_SHA256\n  certificado: CN=" + DOMINIO + "\n  emisor: Autoridad de Certificación del Laboratorio (sintética)\n  validez: ficticia, solo para la simulación",
        nota_aprender: "El servidor elige un cifrado común y presenta su certificado: un documento firmado que demuestra que quien responde es realmente " + DOMINIO + ". El navegador comprueba la firma contra su lista de autoridades de confianza." }),
      evento({ id: "E09", t_ms: 100, etapa: "tls", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "TLS", tam_bytes: 74, estado: "ok",
        resumen: "TLS Finished: canal cifrado listo",
        detalle: "TLS 1.3 Finished\n  claves de sesión derivadas (HKDF)\n  a partir de aquí todo el tráfico va cifrado",
        nota_aprender: "Ambos extremos derivan las mismas claves simétricas y verifican que nadie manipuló la negociación. Desde este momento, todo lo que se envíe va cifrado de extremo a extremo del canal TLS." }),
      evento({ id: "E10", t_ms: 104, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "HTTP", tam_bytes: 412, estado: "ok",
        resumen: "GET / — el navegador pide la página",
        detalle: "GET / HTTP/1.1\nHost: " + DOMINIO + "\nUser-Agent: NavegadorLaboratorio/1.0\nAccept: text/html\nAccept-Language: es\n\n(en la red este texto viaja cifrado por TLS; se muestra descifrado para estudiarlo)",
        nota_aprender: "La petición HTTP: método GET (“dame”), ruta “/” (la portada) y cabeceras con contexto. La cabecera Host repite el dominio porque un mismo servidor puede alojar varios sitios." }),
      evento({ id: "E11", t_ms: 168, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "HTTP", tam_bytes: 1284, estado: "ok",
        resumen: "200 OK — llega la página",
        detalle: "HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\nContent-Length: 1084\nCache-Control: max-age=60\n\n<!doctype html><html lang=\"es\">… (cuerpo sintético abreviado)",
        nota_aprender: "El servidor responde 200 OK (todo correcto) con el HTML de la página. Viaja cifrado, cruza el proveedor, el router deshace el NAT y el paquete llega al equipo." }),
      evento({ id: "E12", t_ms: 176, etapa: "http_respuesta", tipo: "estado", desde: "equipo", hasta: "equipo",
        origen_ip: null, origen_puerto: null, destino_ip: null, destino_puerto: null,
        protocolo: "—", tam_bytes: null, estado: "ok",
        resumen: "El navegador dibuja la página",
        detalle: "render (dibujado)\n  documento: text/html, 1084 bytes\n  t_total simulado: 176 ms desde la barra de direcciones hasta la página",
        nota_aprender: "Fin del viaje: el navegador interpreta el HTML y pinta la página. Todo el recorrido —DNS, NAT, TCP, TLS, HTTP— cabe en unas décimas de segundo en una red doméstica típica." })
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Escenario 2: fallo de DNS (el viaje se detiene en la primera etapa) */
  /* ------------------------------------------------------------------ */
  function eventosFalloDns() {
    return [
      evento({ id: "E01", t_ms: 0, etapa: "dns", desde: "equipo", hasta: "dns",
        origen_ip: EQ, origen_puerto: P_DNS_EQ, destino_ip: DN, destino_puerto: 53,
        protocolo: "UDP", tam_bytes: 76, estado: "ok",
        resumen: "Consulta DNS: ¿qué IP tiene " + DOMINIO_INEXISTENTE + "?",
        detalle: "consulta DNS tipo A\n  nombre: " + DOMINIO_INEXISTENTE + "\n  clase: IN\n  id-transaccion: 0x77b1",
        nota_aprender: "Alguien tecleó un nombre que no existe (una errata, un enlace viejo…). El equipo no puede saberlo aún: pregunta al resolvedor igual que siempre." }),
      evento({ id: "E02", t_ms: 21, etapa: "dns", desde: "dns", hasta: "equipo",
        origen_ip: DN, origen_puerto: 53, destino_ip: EQ, destino_puerto: P_DNS_EQ,
        protocolo: "UDP", tam_bytes: 76, estado: "error",
        resumen: "Respuesta DNS: NXDOMAIN — el dominio no existe",
        detalle: "respuesta DNS\n  nombre: " + DOMINIO_INEXISTENTE + "\n  rcode: 3 NXDOMAIN (non-existent domain: dominio inexistente)\n  SOA de la zona example en la sección de autoridad",
        nota_aprender: "El resolvedor buscó y la respuesta es tajante: ese nombre no existe. NXDOMAIN no es un fallo de tu red: es una respuesta correcta que dice “no hay nada con ese nombre”." }),
      evento({ id: "E03", t_ms: 25, etapa: "dns", tipo: "estado", desde: "equipo", hasta: "equipo",
        origen_ip: null, origen_puerto: null, destino_ip: null, destino_puerto: null,
        protocolo: "—", tam_bytes: null, estado: "error",
        resumen: "El navegador muestra un error y el viaje termina aquí",
        detalle: "estado del navegador\n  error: no se pudo encontrar el servidor\n  causa: NXDOMAIN en la resolución DNS\n  etapas NO alcanzadas: NAT, TCP, TLS, HTTP",
        nota_aprender: "Sin dirección IP no hay a quién conectarse: no habrá NAT, ni TCP, ni TLS, ni HTTP. Por eso la resolución DNS es la primera etapa crítica del viaje: si falla, todo lo demás ni siquiera empieza." })
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Escenario 3: varios intentos fallidos de acceso.                    */
  /* Perspectiva defensiva: cómo responde y se protege un servidor.  */
  /* ------------------------------------------------------------------ */
  function eventosIntentosFallidos() {
    return [
      evento({ id: "E01", t_ms: 0, etapa: "dns", desde: "equipo", hasta: "dns",
        origen_ip: EQ, origen_puerto: P_DNS_EQ, destino_ip: DN, destino_puerto: 53,
        protocolo: "UDP", tam_bytes: 74, estado: "ok",
        resumen: "Consulta DNS para " + DOMINIO,
        detalle: "consulta DNS tipo A\n  nombre: " + DOMINIO + "\n  id-transaccion: 0x1c09",
        nota_aprender: "El viaje empieza igual que en la navegación normal: primero hay que resolver el nombre." }),
      evento({ id: "E02", t_ms: 17, etapa: "dns", desde: "dns", hasta: "equipo",
        origen_ip: DN, origen_puerto: 53, destino_ip: EQ, destino_puerto: P_DNS_EQ,
        protocolo: "UDP", tam_bytes: 90, estado: "ok",
        resumen: "Respuesta DNS: " + SV,
        detalle: "respuesta DNS\n  " + DOMINIO + " → " + SV + "\n  TTL: 300 s",
        nota_aprender: "Resolución correcta: ya tenemos la dirección del servidor." }),
      evento({ id: "E03", t_ms: 22, etapa: "nat", tipo: "estado", desde: "router", hasta: "router",
        origen_ip: EQ, origen_puerto: P_TCP_EQ, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "—", tam_bytes: null, estado: "info",
        resumen: "Entrada NAT creada en el router",
        detalle: "tabla NAT\n  " + EQ + ":" + P_TCP_EQ + " ⇄ " + RW + ":" + P_TCP_NAT + " → " + SV + ":443",
        nota_aprender: "Para el servidor, TODOS los intentos que siguen vendrán de la misma dirección pública: " + RW + ". Eso es lo que el servidor puede observar y limitar." }),
      evento({ id: "E04", t_ms: 25, etapa: "tcp", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "TCP", tam_bytes: 60, estado: "ok",
        resumen: "Apretón de manos TCP (resumido)",
        detalle: "SYN → SYN-ACK → ACK completados\n  (se resume en un evento para centrar la atención en los intentos de acceso)",
        nota_aprender: "La conexión se establece con normalidad; el problema vendrá después, en la capa de aplicación." }),
      evento({ id: "E05", t_ms: 60, etapa: "tls", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "TLS", tam_bytes: 2890, estado: "ok",
        resumen: "Negociación TLS completada (resumida)",
        detalle: "TLS 1.3 establecido\n  suite: TLS_AES_128_GCM_SHA256\n  canal cifrado activo",
        nota_aprender: "El cifrado protege la contraseña en tránsito, pero no impide equivocarse al teclearla… ni ampara a quien prueba contraseñas ajenas." }),
      evento({ id: "E06", t_ms: 70, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "HTTP", tam_bytes: 486, estado: "ok",
        resumen: "Intento 1: POST /acceso con credenciales",
        detalle: "POST /acceso HTTP/1.1\nHost: " + DOMINIO + "\nContent-Type: application/x-www-form-urlencoded\n\nusuario=estudiante&clave=********\n(la clave nunca se muestra; viaja cifrada por TLS)",
        nota_aprender: "Primer intento de iniciar sesión. La contraseña viaja cifrada dentro del túnel TLS; el servidor la compara con su registro (almacenado con hash, no en claro)." }),
      evento({ id: "E07", t_ms: 118, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "HTTP", tam_bytes: 312, estado: "advertencia",
        resumen: "Intento 1 fallido: 401 Unauthorized",
        detalle: "HTTP/1.1 401 Unauthorized (no autorizado)\nWWW-Authenticate: Form\n\n{\"error\":\"credenciales incorrectas\",\"intentos_restantes\":2}",
        nota_aprender: "401 significa “no autorizado”: las credenciales no son válidas. Fíjate en que el servidor NO dice si falló el usuario o la clave: dar pistas facilitaría ataques de adivinación." }),
      evento({ id: "E08", t_ms: 3480, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "HTTP", tam_bytes: 486, estado: "ok",
        resumen: "Intento 2: POST /acceso",
        detalle: "POST /acceso HTTP/1.1\nHost: " + DOMINIO + "\n\nusuario=estudiante&clave=********",
        nota_aprender: "Segundo intento, unos segundos después. El servidor lleva la cuenta de fallos por cuenta y por dirección de origen." }),
      evento({ id: "E09", t_ms: 3529, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "HTTP", tam_bytes: 312, estado: "advertencia",
        resumen: "Intento 2 fallido: 401 Unauthorized",
        detalle: "HTTP/1.1 401 Unauthorized\n\n{\"error\":\"credenciales incorrectas\",\"intentos_restantes\":1}",
        nota_aprender: "Segundo 401. Los registros del servidor (logs: bitácoras) ya muestran un patrón: misma cuenta, misma dirección de origen, fallos consecutivos." }),
      evento({ id: "E10", t_ms: 6902, etapa: "http_solicitud", desde: "equipo", hasta: "servidor",
        origen_ip: RW, origen_puerto: P_TCP_NAT, destino_ip: SV, destino_puerto: 443,
        protocolo: "HTTP", tam_bytes: 486, estado: "ok",
        resumen: "Intento 3: POST /acceso",
        detalle: "POST /acceso HTTP/1.1\nHost: " + DOMINIO + "\n\nusuario=estudiante&clave=********",
        nota_aprender: "Tercer intento consecutivo. Un sistema defensivo bien configurado está a punto de actuar." }),
      evento({ id: "E11", t_ms: 6951, etapa: "http_respuesta", desde: "servidor", hasta: "equipo",
        origen_ip: SV, origen_puerto: 443, destino_ip: RW, destino_puerto: P_TCP_NAT,
        protocolo: "HTTP", tam_bytes: 344, estado: "error",
        resumen: "Intento 3: 429 Too Many Requests — acceso limitado",
        detalle: "HTTP/1.1 429 Too Many Requests (demasiadas peticiones)\nRetry-After: 300\n\n{\"error\":\"demasiados intentos fallidos\",\"reintentar_en_s\":300}",
        nota_aprender: "El servidor se defiende con limitación de tasa (rate limiting): tras varios fallos responde 429 y obliga a esperar 300 segundos. Así frena tanto los despistes como los intentos de adivinar contraseñas por fuerza bruta." }),
      evento({ id: "E12", t_ms: 6960, etapa: "http_respuesta", tipo: "estado", desde: "servidor", hasta: "servidor",
        origen_ip: null, origen_puerto: null, destino_ip: null, destino_puerto: null,
        protocolo: "—", tam_bytes: null, estado: "advertencia",
        resumen: "El servidor registra el patrón y avisa al equipo de seguridad",
        detalle: "registro del servidor (extracto sintético)\n  3 fallos de acceso para “estudiante” desde " + RW + " en 7 s\n  acción: bloqueo temporal 300 s + alerta al panel de seguridad\n  recomendación al usuario legítimo: restablecer la contraseña",
        nota_aprender: "Lección defensiva: los servidores vigilan patrones (misma cuenta, mismo origen, poco tiempo) y responden con bloqueos temporales, alertas y, a menudo, verificación adicional (MFA: multi-factor authentication, autenticación multifactor). Probar credenciales ajenas es ilegal y, además, deja rastro." })
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Catálogo de escenarios.                                          */
  /* ------------------------------------------------------------------ */
  var ESCENARIOS = [
    { clave: "normal", nombre: "Navegación normal",
      descripcion: "El viaje completo y feliz: DNS, NAT, TCP, TLS, petición y respuesta HTTP.",
      fabricar: eventosNormal },
    { clave: "fallo-dns", nombre: "Fallo de DNS",
      descripcion: "El nombre no existe (NXDOMAIN) y el viaje se detiene en la primera etapa.",
      fabricar: eventosFalloDns },
    { clave: "intentos-fallidos", nombre: "Intentos fallidos de acceso",
      descripcion: "Tres inicios de sesión fallidos y la defensa del servidor: 401, 429 y bloqueo temporal.",
      fabricar: eventosIntentosFallidos }
  ];

  function listaEscenarios() {
    return ESCENARIOS.map(function (e) {
      return { clave: e.clave, nombre: e.nombre, descripcion: e.descripcion };
    });
  }

  function eventosDe(claveEscenario) {
    for (var i = 0; i < ESCENARIOS.length; i++) {
      if (ESCENARIOS[i].clave === claveEscenario) return ESCENARIOS[i].fabricar();
    }
    throw new Error("Escenario desconocido: " + claveEscenario);
  }

  /* Etapas presentes en un escenario, en orden canónico. */
  function etapasPresentes(eventos) {
    var vistas = {};
    eventos.forEach(function (e) { vistas[e.etapa] = true; });
    return ETAPAS.filter(function (et) { return vistas[et.clave]; })
                 .map(function (et) { return et.clave; });
  }

  /* ------------------------------------------------------------------ */
  /* Reproductor: máquina de estados pura.                            */
  /* indice = -1 significa "antes del primer evento".                    */
  /* ------------------------------------------------------------------ */
  function reproductorInicial() {
    return { indice: -1, reproduciendo: false };
  }

  function avanzar(estado, total) {
    var indice = Math.min(estado.indice + 1, total - 1);
    var fin = indice >= total - 1;
    return { indice: indice, reproduciendo: fin ? false : estado.reproduciendo };
  }

  function retroceder(estado) {
    return { indice: Math.max(estado.indice - 1, -1), reproduciendo: false };
  }

  function reiniciar() {
    return { indice: -1, reproduciendo: false };
  }

  function alternarReproduccion(estado, total) {
    if (estado.indice >= total - 1) {
      // al final, reproducir de nuevo significa volver a empezar
      return { indice: -1, reproduciendo: true };
    }
    return { indice: estado.indice, reproduciendo: !estado.reproduciendo };
  }

  function pausar(estado) {
    return { indice: estado.indice, reproduciendo: false };
  }

  function irA(estado, indice, total) {
    var i = Math.max(-1, Math.min(indice, total - 1));
    return { indice: i, reproduciendo: false };
  }

  /* Primer índice de evento de una etapa dada (o -1 si no está). */
  function primerIndiceDeEtapa(eventos, claveEtapa) {
    for (var i = 0; i < eventos.length; i++) {
      if (eventos[i].etapa === claveEtapa) return i;
    }
    return -1;
  }

  /* ------------------------------------------------------------------ */
  /* Exportadores. Reciben la fecha como texto para ser puros.           */
  /* ------------------------------------------------------------------ */
  function exportarJSON(claveEscenario, eventos, fechaISO) {
    var documento = {
      esquema: ESQUEMA_EVENTOS,
      version_app: VERSION,
      generado_en: fechaISO,
      escenario: claveEscenario,
      aviso: AVISO_SINTETICO,
      campos: CAMPOS_EVENTO.slice(),
      eventos: eventos
    };
    return JSON.stringify(documento, null, 2);
  }

  function rellenar(texto, ancho) {
    texto = String(texto);
    while (texto.length < ancho) texto += " ";
    return texto;
  }

  function rellenarIzq(texto, ancho) {
    texto = String(texto);
    while (texto.length < ancho) texto = " " + texto;
    return texto;
  }

  function exportarLOG(claveEscenario, eventos, fechaISO) {
    var lineas = [];
    lineas.push("# TRAZA v" + VERSION + " — registro de eventos sintéticos");
    lineas.push("# esquema: " + ESQUEMA_EVENTOS + " (formato de línea documentado en LEEME.md)");
    lineas.push("# escenario: " + claveEscenario);
    lineas.push("# generado_en: " + fechaISO);
    lineas.push("# aviso: " + AVISO_SINTETICO);
    lineas.push("#");
    lineas.push("# [t_ms] id etapa tipo protocolo origen -> destino tam estado :: resumen");
    eventos.forEach(function (e) {
      var origen = e.origen_ip ? e.origen_ip + ":" + e.origen_puerto : "—";
      var destino = e.destino_ip ? e.destino_ip + ":" + e.destino_puerto : "—";
      var tam = (e.tam_bytes === null) ? "—" : e.tam_bytes + " B";
      lineas.push(
        "[+" + rellenarIzq(e.t_ms, 7) + " ms] " +
        rellenar(e.id, 4) +
        rellenar(e.etapa, 16) +
        rellenar(e.tipo, 8) +
        rellenar(e.protocolo, 5) +
        rellenar(origen, 21) + "-> " +
        rellenar(destino, 21) +
        rellenarIzq(tam, 7) + "  " +
        rellenar(e.estado, 12) + ":: " +
        e.resumen + " (SINTETICO)"
      );
    });
    return lineas.join("\n") + "\n";
  }

  /* ------------------------------------------------------------------ */
  /* Retos guiados.                                                      */
  /* La explicación experta permanece oculta hasta que el intento     */
  /* propio tenga al menos MIN_CARACTERES_INTENTO caracteres útiles.  */
  /* ------------------------------------------------------------------ */
  var MIN_CARACTERES_INTENTO = 40;

  var RETOS = [
    {
      clave: "reto-dns",
      titulo: "Reto 1 · El listado telefónico",
      pregunta: "Con el escenario “Navegación normal”: ¿por qué el equipo necesita la etapa DNS antes de poder conectarse al servidor? ¿Qué pasaría si la respuesta DNS trajera una dirección equivocada?",
      pista: "Mira E01 y E02: qué se pregunta y qué se responde. Luego mira a qué dirección va E04.",
      explicacion: "Los paquetes solo se encaminan por direcciones IP, nunca por nombres: el nombre es para personas. Por eso el equipo pregunta primero (E01) y solo cuando recibe la dirección (E02, " + "192.0.2.80" + ") puede abrir la conexión TCP hacia ella (E04). Si la respuesta trajera una dirección equivocada —por error o por manipulación— el equipo se conectaría con total confianza al servidor equivocado; TLS existe precisamente para detectar esa suplantación: el certificado del impostor no validaría para el dominio pedido. Hecho: RFC 1034/1035 (DNS) y RFC 8446 (TLS). Valores concretos: simulación."
    },
    {
      clave: "reto-nat",
      titulo: "Reto 2 · El portero del edificio",
      pregunta: "Observa el evento NAT (E03) y después el SYN (E04). ¿Qué dos datos del paquete cambia el router y por qué el servidor nunca ve la dirección 192.168.1.23?",
      pista: "Compara la columna “IP origen” del inspector antes y después del router.",
      explicacion: "El router reescribe la IP de origen (192.168.1.23 → 203.0.113.42) y el puerto de origen (51402 → 40817), y guarda la equivalencia en su tabla NAT. Las direcciones privadas (RFC 1918) no son encaminables en internet: ningún router del proveedor sabría devolver la respuesta a “192.168.1.23” porque hay millones de redes domésticas usando ese mismo rango. Gracias a la tabla, cuando vuelve la respuesta hacia 203.0.113.42:40817 el router sabe entregársela al equipo. Hecho: RFC 2663/3022 (NAT), RFC 1918 (rangos privados). Tabla concreta: simulación."
    },
    {
      clave: "reto-tcp",
      titulo: "Reto 3 · Tres pasos antes de hablar",
      pregunta: "El apretón de manos TCP usa tres mensajes (E04, E05, E06). ¿Por qué no bastan dos? ¿Qué garantiza el tercero (ACK)?",
      pista: "Piensa qué sabe cada extremo después de cada mensaje: ¿quién ha confirmado qué?",
      explicacion: "Con dos mensajes el servidor nunca sabría si su SYN-ACK llegó: enviaría datos a ciegas hacia alguien que quizá ya no escucha. El tercer mensaje (ACK, E06) confirma al servidor que el cliente recibió su respuesta y que ambos conocen los números de secuencia del otro; solo entonces los dos extremos consideran la conexión establecida y pueden detectar pérdidas y duplicados. Además, exigir el tercer paso dificulta que alguien abra conexiones con una dirección de origen falsificada, porque nunca recibiría el SYN-ACK. Hecho: RFC 9293. Números de secuencia mostrados: simulación."
    },
    {
      clave: "reto-tls",
      titulo: "Reto 4 · Lo que el cifrado no esconde",
      pregunta: "Mira el ClientHello (E07) en modo INSPECCIONAR. TLS cifra el contenido, pero ¿qué información puede seguir viendo un observador de la red? ¿Por qué?",
      pista: "Busca el campo SNI en la evidencia de E07 y fíjate en qué momento se envía.",
      explicacion: "Un observador sigue viendo los metadatos: direcciones IP de origen y destino, puertos, tamaños, instantes… y el SNI (server name indication: indicación del nombre del servidor) del ClientHello, que viaja antes de que existan claves de cifrado, revelando A QUÉ dominio te conectas. TLS protege QUÉ dices (la petición, la respuesta, las credenciales), no CON QUIÉN hablas ni CUÁNTO. Por eso existen propuestas como ECH (Encrypted Client Hello: saludo de cliente cifrado) para cifrar también el SNI. Hecho: RFC 8446. Valores mostrados: simulación."
    },
    {
      clave: "reto-defensa",
      titulo: "Reto 5 · La defensa del servidor",
      pregunta: "En el escenario “Intentos fallidos de acceso”: ¿qué tres señales usa el servidor para detectar el patrón sospechoso y qué hace exactamente el código 429?",
      pista: "Compara E07, E09 y E11: qué cambia entre las tres respuestas. Luego lee E12.",
      explicacion: "Las señales del patrón: (1) la misma cuenta —“estudiante”— falla repetidamente; (2) los intentos llegan desde el mismo origen público (203.0.113.42, la dirección del router tras el NAT); (3) ocurren en muy poco tiempo. Tras el tercer fallo el servidor responde 429 Too Many Requests (demasiadas peticiones) con Retry-After: 300, es decir, limitación de tasa: rechaza nuevos intentos durante 300 segundos aunque la contraseña fuera correcta. Eso convierte la adivinación por fuerza bruta en algo lentísimo y ruidoso: cada fallo queda registrado y genera alertas. Defensas complementarias habituales: MFA y aviso al titular de la cuenta. Hecho: RFC 6585 define 429. Registro mostrado: simulación."
    }
  ];

  function puedeRevelar(textoIntento) {
    if (typeof textoIntento !== "string") return false;
    return textoIntento.trim().length >= MIN_CARACTERES_INTENTO;
  }

  /* ------------------------------------------------------------------ */
  /* API pública del núcleo.                                       */
  /* ------------------------------------------------------------------ */
  return {
    VERSION: VERSION,
    ESQUEMA_EVENTOS: ESQUEMA_EVENTOS,
    CAMPOS_EVENTO: CAMPOS_EVENTO,
    AVISO_SINTETICO: AVISO_SINTETICO,
    MIN_CARACTERES_INTENTO: MIN_CARACTERES_INTENTO,
    NODOS: NODOS,
    DIRECCIONES: DIRECCIONES,
    DOMINIO: DOMINIO,
    DOMINIO_INEXISTENTE: DOMINIO_INEXISTENTE,
    ETAPAS: ETAPAS,
    GLOSARIO: GLOSARIO,
    RETOS: RETOS,
    listaEscenarios: listaEscenarios,
    eventosDe: eventosDe,
    etapasPresentes: etapasPresentes,
    reproductorInicial: reproductorInicial,
    avanzar: avanzar,
    retroceder: retroceder,
    reiniciar: reiniciar,
    alternarReproduccion: alternarReproduccion,
    pausar: pausar,
    irA: irA,
    primerIndiceDeEtapa: primerIndiceDeEtapa,
    exportarJSON: exportarJSON,
    exportarLOG: exportarLOG,
    puedeRevelar: puedeRevelar
  };
});
