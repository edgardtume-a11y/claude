# TRAZA v1.0.0 — FUENTES

Este documento separa, etapa por etapa, **qué es un hecho documentado** (con su fuente
técnica primaria) y **qué es simulación** (valores inventados por TRAZA para poder
enseñar). La regla general del producto: *los conceptos proceden de fuentes; todos los
valores concretos —direcciones, puertos, tiempos, tamaños, números de secuencia,
contenidos— proceden de la simulación.*

Las fuentes primarias son los RFC (*Request for Comments*: los documentos normativos de
internet, publicados por el IETF, *Internet Engineering Task Force*: grupo de trabajo de
ingeniería de internet). Se citan por número; pueden consultarse en el sitio del IETF
(rfc-editor.org) cuando haya conexión. TRAZA no los necesita para funcionar.

---

## Identificadores sintéticos del laboratorio

| Valor usado | Qué es | Fuente de la elección |
| --- | --- | --- |
| `192.168.1.23`, `192.168.1.1` | Equipo y router en la red doméstica | Rango privado 192.168.0.0/16 reservado por **RFC 1918**; valores concretos: simulación |
| `203.0.113.42` | Dirección pública del router | Rango TEST-NET-3 (203.0.113.0/24) reservado **para documentación** por **RFC 5737**; valor concreto: simulación |
| `198.51.100.53` | Resolvedor DNS del proveedor | Rango TEST-NET-2 (198.51.100.0/24), **RFC 5737**; valor concreto: simulación |
| `192.0.2.80` | Servidor web | Rango TEST-NET-1 (192.0.2.0/24), **RFC 5737**; valor concreto: simulación |
| `laboratorio.example`, `no-existe.example` | Dominios del laboratorio | El TLD `.example` está reservado por **RFC 2606** (y RFC 6761) para ejemplos: nunca resuelve en la internet real |
| Puertos 53, 443 | DNS y HTTPS | Asignaciones de servicio bien conocidas (registro de IANA, *Internet Assigned Numbers Authority*: autoridad de números asignados de internet) |
| Puertos 51324, 51402, 40817 | Puertos efímeros del equipo y del NAT | El rango dinámico sugerido es 49152–65535 (**RFC 6335**); valores concretos: simulación |

Estas reservas son precisamente la razón de usarlas: **ningún dato de TRAZA puede
coincidir con un equipo real de internet.**

## Etapa 1 · Resolución DNS

- **Hecho** — El DNS traduce nombres de dominio a direcciones; el mensaje de consulta y
  respuesta, el tipo de registro `A`, la clase `IN` y el TTL están definidos en
  **RFC 1034** y **RFC 1035**. La respuesta `NXDOMAIN` (rcode 3) y su tratamiento en
  caché están descritos en **RFC 2308**. La consulta viaja habitualmente sobre UDP
  puerto 53.
- **Simulación** — El identificador de transacción (`0x4a2f`…), los tamaños (74–90
  bytes), la latencia (18–21 ms), el TTL de 300 s y el propio resolvedor son inventados
  con magnitudes plausibles.

## Etapa 2 · Traducción NAT

- **Hecho** — La terminología NAT está en **RFC 2663**; el NAT tradicional con
  traducción de puertos (NAPT) en **RFC 3022**. Los rangos privados que motivan el NAT
  están en **RFC 1918**. El router reescribe dirección y puerto de origen y mantiene una
  tabla para deshacer la traducción en las respuestas.
- **Simulación** — La entrada concreta de la tabla (`192.168.1.23:51402 ⇄
  203.0.113.42:40817`) y el momento en que se crea son inventados.

## Etapa 3 · Conexión TCP

- **Hecho** — El apretón de manos en tres pasos (SYN, SYN-ACK, ACK), los números de
  secuencia, el acuse de recibo y el estado ESTABLISHED están definidos en **RFC 9293**
  (la especificación vigente de TCP). La opción MSS y la ventana también.
- **Simulación** — Los números de secuencia (1183002, 774411), la ventana (64240), el
  MSS (1460), los tamaños de segmento y el RTT (~32 ms) son inventados con magnitudes
  típicas.

## Etapa 4 · Negociación TLS

- **Hecho** — TLS 1.3 está definido en **RFC 8446**: ClientHello con suites y
  `key_share`, ServerHello, certificado del servidor y mensajes Finished, con
  negociación completa en un viaje de ida y vuelta. Los certificados X.509 están
  definidos en **RFC 5280**. El SNI (*Server Name Indication*: indicación del nombre del
  servidor) es una extensión de **RFC 6066** y viaja sin cifrar en el ClientHello (el
  ECH, *Encrypted Client Hello*, que lo cifra, sigue siendo un borrador del IETF en el
  momento de esta versión).
- **Simulación** — Las suites concretas mostradas, los tamaños (517 y 2890 bytes), la
  «Autoridad de Certificación del Laboratorio» (explícitamente ficticia) y los tiempos.
  La negociación se muestra **simplificada**: no se representan HelloRetryRequest,
  reanudación de sesión, 0-RTT ni la lista completa de extensiones.

## Etapa 5 · Petición HTTP

- **Hecho** — La semántica de HTTP (métodos como GET y POST, cabeceras como `Host`,
  `Content-Type`, `Accept`) está en **RFC 9110**; la sintaxis HTTP/1.1 en **RFC 9112**.
  Bajo HTTPS, la petición viaja cifrada dentro del túnel TLS.
- **Simulación** — El texto completo de la petición (agente de usuario
  «NavegadorLaboratorio/1.0», rutas, tamaños). TRAZA lo muestra descifrado y lo indica:
  en la red real ese texto no es observable por terceros.

## Etapa 6 · Respuesta HTTP

- **Hecho** — Los códigos de estado están en **RFC 9110**: `200 OK`, `401 Unauthorized`
  (con el marco de autenticación de HTTP), `404 Not Found`. El código `429 Too Many
  Requests` y la cabecera `Retry-After` para limitación de tasa están en **RFC 6585**.
- **Simulación** — Los cuerpos de respuesta, el HTML «recibido», `Content-Length`,
  tiempos y tamaños.

## Escenario «Intentos fallidos de acceso» (perspectiva defensiva)

- **Hecho** — Responder `401` sin revelar si falló el usuario o la contraseña, contar
  fallos por cuenta y por origen, aplicar limitación de tasa con `429` + `Retry-After`
  (**RFC 6585**), registrar los intentos y añadir autenticación multifactor son
  prácticas de defensa ampliamente recomendadas (por ejemplo, en las guías de
  autenticación del NIST SP 800-63B y de OWASP sobre gestión de sesiones y fuerza
  bruta).
- **Simulación** — El registro del servidor, la cuenta «estudiante», el umbral de 3
  intentos y el bloqueo de 300 segundos son inventados para ilustrar el patrón. Cada
  despliegue real elige sus propios umbrales.

## Sobre los tiempos y la animación

- **Hecho** — El orden causal de los eventos (no puede haber SYN antes de resolver el
  nombre; no puede haber petición antes del Finished de TLS) se corresponde con el
  funcionamiento real de los protocolos citados.
- **Simulación** — Todos los instantes `t_ms` son inventados con magnitudes plausibles
  para una red doméstica. Además, la reproducción **comprime y acota** esos tiempos
  (entre ~0,75 y ~2,2 segundos por paso) para que el ojo pueda seguirlos: la barra de
  reproducción no es un cronómetro.

## Qué no es TRAZA

- No es un capturador de paquetes ni un analizador de red: no observa, mide ni contacta
  con ninguna red real.
- No incluye ninguna utilidad de escaneo, clasificación de direcciones, explotación ni
  evasión.
- No recopila ningún dato: no hay telemetría, ni almacenamiento persistente, ni
  llamadas externas (la política CSP del propio archivo las bloquea).
