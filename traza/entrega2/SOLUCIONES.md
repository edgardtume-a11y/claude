# SOLUCIONES — hoja de respuestas del conjunto de práctica TRAZA v1.0.0

**Este archivo revela todas las anomalías plantadas.** Va aparte a propósito: no lo leas
hasta haber intentado el análisis. Los números de línea se refieren a
`traza_practica.log` tal como se entrega (contando desde 1, cabecera incluida); los
identificadores de evento valen para las dos versiones.

Todo el conjunto es sintético (rangos RFC 5737 / RFC 1918, dominios .example).

---

## 1 · Patrones de comportamiento que había que detectar

### 1.1 Ráfaga de intentos de acceso fallidos (fuerza bruta)
- **Cuándo**: miércoles 2026-08-19, 14:12–14:19 UTC (~7 minutos).
- **Qué**: 45 `POST /acceso` hacia `acceso.example` (192.0.2.84) desde el origen
  externo **203.0.113.66**, con 44 respuestas `401` y una `429` final con
  `Retry-After: 600`, seguida del evento de estado del servidor (bloqueo y alerta).
- **Dónde**: eventos E1148–E1239 (92 eventos);
  en el log, líneas 1164–1255.
- **Cómo se detecta**: filtrar por origen 203.0.113.66 o por resumen «401»; contar
  fallos por origen y ventana de tiempo; nombres de usuario rotando (admin, raiz…).

### 1.2 Actividad en horario inusual
- **Cuándo**: madrugadas del martes 2026-08-18 y del jueves 2026-08-20, 02:30–04:10 UTC.
- **Qué**: 12 sesiones de navegación del equipo **sobremesa (192.168.1.22)** hacia
  `archivos.example` y `correo.example`, cuando todo el resto del tráfico del
  laboratorio ocurre entre las 07:00 y las 23:30.
- **Dónde**: 134 eventos entre E0399 y E1564;
  en el log, entre las líneas 410 y 1584 (en dos bloques, uno por noche).
- **Cómo se detecta**: convertir t_ms a hora del día (época t0 = 2026-08-17T00:00Z) y
  mirar la distribución horaria. Ojo: tras el NAT la mayoría de líneas muestran el origen
  203.0.113.42; la atribución al sobremesa sale de las líneas DNS y NAT de cada sesión,
  que sí conservan 192.168.1.22.

### 1.3 Errores de resolución repetidos
- **Cuándo**: desde el 2026-08-19 12:00 UTC hasta la tarde del viernes 2026-08-21, una consulta cada 40–50 minutos, día y noche.
- **Qué**: el dispositivo **sensor-iot (192.168.1.25)** consulta una y otra vez
  `actualizaciones.no-existe.example` y recibe **70 respuestas NXDOMAIN** (140 eventos
  en total). Patrón típico de un dispositivo mal configurado u obsoleto.
- **Dónde**: eventos entre E1084 y E2609; en el log, entre las líneas
  1100 y 2635 (intercalados con el tráfico normal).
- **Cómo se detecta**: agrupar respuestas DNS con estado `error`; un mismo nombre
  fallando decenas de veces desde el mismo origen.

### 1.4 Pico de peticiones
- **Cuándo**: jueves 2026-08-20, 20:00–20:10 UTC (~10 minutos).
- **Qué**: el equipo **movil (192.168.1.23)** lanza **160 pares** de
  `GET /api/v1/estado` contra `api.example` (192.0.2.81), unas 16 peticiones/minuto
  sostenidas: una aplicación sondeando sin control. Todas responden 200.
- **Dónde**: 327 eventos entre E2007 y E2333; en el log,
  líneas 2029–2357.
- **Cómo se detecta**: histograma de eventos por minuto; el pico multiplica varias veces
  la tasa base del resto del registro.

## 2 · Suciedad estructural plantada en `traza_practica.log`

### 2.1 Cambio de formato a mitad del archivo
- **Línea 1548**: aparece `# reinicio del recolector de registros` y desde la
  línea siguiente el formato cambia del formato A (`[+ t_ms ms] … :: resumen`) al
  formato B (11 campos separados por `|` con fecha ISO 8601). Nada lo vuelve a avisar.

### 2.2 Líneas malformadas (6)
- Línea 109 — línea truncada a 44 caracteres (escritura interrumpida)
- Línea 462 — línea que solo contiene «[+»
- Línea 996 — bloque de basura sin estructura
- Línea 1418 — línea de formato A sin separador «::» ni resumen
- Línea 2022 — línea de formato B con solo 6 de los 11 campos
- Línea 2324 — fragmento de JSON volcado por error dentro del log

### 2.3 Líneas duplicadas (10)
- Línea 270 — duplicado inmediato de la línea del evento E0260
- Línea 623 — duplicado inmediato de la línea del evento E0610
- Línea 905 — duplicado inmediato de la línea del evento E0890
- Línea 1257 — duplicado inmediato de la línea del evento E1240
- Línea 1701 — duplicado inmediato de la línea del evento E1680
- Línea 2133 — duplicado inmediato de la línea del evento E2110
- Línea 2546 — duplicado inmediato de la línea del evento E2520
- Línea 380 — duplicado alejado (~40 líneas después) de la línea del evento E0330
- Línea 1558 — duplicado alejado (~40 líneas después) de la línea del evento E1500
- Línea 2424 — duplicado alejado (~40 líneas después) de la línea del evento E2360

### 2.4 Marcas de tiempo desordenadas
- Líneas 773, 774, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784 — bloque de 12 líneas rotado 5 posiciones (t_ms no monótono)
- Líneas 532, 533 — pareja adyacente intercambiada (eventos E0520 y el siguiente)
- Líneas 1337, 1338 — pareja adyacente intercambiada (eventos E1320 y el siguiente)
- Líneas 2475, 2476 — pareja adyacente intercambiada (eventos E2450 y el siguiente)

### 2.5 Caracteres no ASCII / codificación rota
- Líneas 713 — línea del evento E0700 con UTF-8 doblemente codificado (Ã³, Ã‰…)
- Líneas 1620 — línea del evento E1600 con UTF-8 doblemente codificado (Ã³, Ã‰…)
- Líneas 2495 — línea del evento E2470 con UTF-8 doblemente codificado (Ã³, Ã‰…)
- Líneas 1166 — línea del evento E1150 con carácter de sustitución U+FFFD (�) al inicio del resumen
- Líneas 1871 — línea del evento E1850 termina en un espacio duro invisible U+00A0

### 2.6 Relojes rotos
- Línea 854 — línea con instante negativo [+ -1840 ms] (reloj retrasado)
- Líneas 2072 — línea del evento E2050 fechada en 2036 (reloj adelantado diez años)
- Líneas 2626 — línea del evento E2600 fechada en 2036 (reloj adelantado diez años)

### 2.7 Campos vacíos en formato B
- Líneas 2173 — línea del evento E2150 con el campo estado vacío (||)
- Líneas 2726 — línea del evento E2700 con el campo estado vacío (||)

## 3 · Suciedad de contenido plantada en `traza_practica.json`

El JSON es sintácticamente válido (se puede cargar con cualquier lector de JSON), pero
sus datos contienen estos defectos:

- **objeto duplicado** — evento E0212: el evento aparece dos veces seguidas, byte a byte idéntico
- **objeto duplicado** — evento E0847: el evento aparece dos veces seguidas, byte a byte idéntico
- **objeto duplicado** — evento E1633: el evento aparece dos veces seguidas, byte a byte idéntico
- **objeto duplicado** — evento E2405: el evento aparece dos veces seguidas, byte a byte idéntico
- **colisión de id** — evento E0500: dos eventos distintos comparten id (el segundo era E1890); su t_ms los delata
- **orden cronológico roto** — evento E0333: el evento está desplazado ~9 posiciones respecto a su t_ms
- **orden cronológico roto** — evento E1210: el evento está desplazado ~9 posiciones respecto a su t_ms
- **orden cronológico roto** — evento E2101: el evento está desplazado ~9 posiciones respecto a su t_ms
- **campo vacío** — evento E0155: el campo «protocolo» es una cadena vacía
- **campo vacío** — evento E0940: el campo «protocolo» es una cadena vacía
- **campo vacío** — evento E1777: el campo «protocolo» es una cadena vacía
- **campo vacío** — evento E0670: el campo «estado» es una cadena vacía
- **campo vacío** — evento E2240: el campo «estado» es una cadena vacía
- **campo ausente** — evento E1502: el campo «estado» no existe en el objeto
- **tipo incorrecto** — evento E1099: t_ms es una cadena ("217298574") en lugar de un número
- **codificación rota (mojibake)** — evento E1961: resumen con UTF-8 doblemente codificado: «ApretÃ³n de manos TCP completado con noticias.example…»

## 4 · Relación entre las dos versiones

Ambos archivos proceden del mismo registro base de 2780 eventos. La
versión JSON recibió la suciedad de contenido del punto 3; la versión .log, la suciedad
estructural del punto 2. Por tanto **ninguna de las dos copias es totalmente fiel** y no
coinciden exactamente entre sí: comparar ambas es, en sí mismo, un ejercicio.
