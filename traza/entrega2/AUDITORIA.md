# AUDITORÍA EXTERNA — TRAZA v1.0.0

**Rol del revisor**: auditor externo hostil, sin participación en la construcción del
producto. Objetivo: encontrar fallos en `traza.html`, `pruebas.html`, `LEEME.md` y
`FUENTES.md` tal como fueron entregados (paquete `TRAZA_v1.0.0.zip`).

**Método**: lectura crítica del contenido educativo contra las especificaciones citadas
(RFC 1034/1035, 9293, 8446, 9110, 6585…), inspección del código incrustado, y un sondeo
automatizado de casos límite en Chromium (`verificacion/sondeo-auditoria.js`, solo
lectura). Los hallazgos marcados «(sondeo Pn)» tienen evidencia de ejecución; el resto
proceden de análisis estático.

**Nada de lo listado está corregido**: este documento solo registra los hallazgos.

**Resumen**: 3 hallazgos de severidad ALTA, 8 MEDIA, 12 BAJA. Dos categorías salen
esencialmente limpias (robustez ante pulsaciones fuera de orden; funcionamiento sin
conexión), y así se declara.

---

## 1 · Contenido técnico: afirmaciones incorrectas o simplificadas de más

### A1 · ALTA — La consulta DNS viaja con IP privada hasta el resolvedor, sin NAT
- **Ubicación**: eventos `E01`/`E02` de los tres escenarios y evento `E03` (nucleo.js,
  incrustado en `traza.html`); inspector con «IP origen 192.168.1.23 → 198.51.100.53».
- **Problema**: la consulta DNS se muestra saliendo del equipo con origen
  `192.168.1.23:51324` directo al resolvedor del proveedor, y la respuesta vuelve
  dirigida a esa misma IP privada. La traducción NAT se presenta *después* (E03),
  explícitamente «para la nueva conexión» TCP. Un principiante puede concluir dos cosas
  falsas: (a) que las direcciones privadas viajan por internet, o (b) que el NAT solo se
  aplica a TCP. En la realidad, la consulta DNS hacia un resolvedor externo atraviesa el
  mismo NAT (o se dirige al propio router, que hace de proxy DNS, el caso doméstico más
  común: el equipo pregunta a 192.168.1.1). La nota de E01 dice «la pregunta cruza el
  router de casa» pero los datos del inspector nunca reflejan traducción alguna.
- **Cambio propuesto**: o bien mostrar la consulta dirigida al router (192.168.1.1:53)
  con un evento de reenvío, o bien mostrar la traducción NAT también para el flujo UDP
  de DNS, o como mínimo una nota en E01/E02 que declare la simplificación.

### A2 · MEDIA — En TLS 1.3 el certificado se muestra como si viajara en claro
- **Ubicación**: evento `E08` («TLS ServerHello + certificado», evidencia con
  `certificado: CN=laboratorio.example`, emisor y validez legibles).
- **Problema**: en TLS 1.3 (RFC 8446) todo lo posterior al ServerHello —incluido el
  mensaje Certificate— viaja **cifrado** con las claves de negociación. La aplicación
  solo aclara «se muestra descifrado para estudiarlo» en la petición HTTP (E10), no
  aquí. Un principiante queda con la idea (cierta en TLS 1.2, falsa en 1.3) de que un
  observador de red puede leer el certificado del servidor.
- **Cambio propuesto**: añadir a la evidencia de E08 la misma aclaración que E10, y una
  línea en FUENTES.md (que menciona la simplificación del apretón de manos pero no el
  cifrado del certificado).

### A3 · MEDIA — `WWW-Authenticate: Form` no existe
- **Ubicación**: escenario «intentos fallidos», evento `E07` (`HTTP/1.1 401 Unauthorized`
  con `WWW-Authenticate: Form`).
- **Problema**: RFC 9110 exige `WWW-Authenticate` en un 401, pero «Form» no es un
  esquema de autenticación registrado en IANA (lo son Basic, Bearer, Digest…). Los
  inicios de sesión con formulario web reales normalmente ni siquiera devuelven esa
  cabecera. Se enseña una cabecera inventada como si fuera real.
- **Cambio propuesto**: usar `Basic realm="laboratorio"` si se quiere ilustrar la
  cabecera, o eliminarla y anotar que la autenticación por formulario gestiona el 401 de
  forma aplicativa.

### A4 · MEDIA — Números de secuencia TCP «bonitos» ocultan una defensa real
- **Ubicación**: eventos `E04`/`E05` (`seq: 1183002`, `seq: 774411`).
- **Problema**: los ISN (números de secuencia iniciales) reales se eligen de forma
  impredecible precisamente como defensa contra la inyección de segmentos y la
  suplantación (RFC 6528, RFC 9293 §3.4.1). Mostrar números pequeños y consecutivos
  sugiere que «empiezan desde poco más de cero», y borra una lección de seguridad que el
  propio Reto 3 roza (menciona la falsificación de origen) sin completar.
- **Cambio propuesto**: usar valores de 32 bits de aspecto aleatorio y una frase en la
  nota: «el número inicial se elige impredecible a propósito».

### A5 · MEDIA — El DNS se presenta como siempre UDP/53 y en claro
- **Ubicación**: explicación de la etapa `dns`; glosario (entrada DNS); E01.
- **Problema**: no se menciona en ninguna parte que los navegadores y sistemas actuales
  usan a menudo DNS cifrado (DoH, *DNS over HTTPS*, RFC 8484; DoT, RFC 7858). Quien
  termine el laboratorio creerá que sus consultas DNS son siempre observables en la red
  local, lo que hoy es frecuentemente falso; y la lección de privacidad del Reto 4 (el
  SNI delata el destino) se queda coja sin su pareja natural (el DNS también, salvo que
  esté cifrado).
- **Cambio propuesto**: una frase en la explicación de etapa y una entrada de glosario.

### A6 · BAJA — IPv6 no existe en el laboratorio
- **Ubicación**: etapa `nat`; FUENTES.md.
- **Problema**: se implica que el NAT es universal en redes domésticas. Con IPv6 (hoy
  mayoritario en muchos operadores) no suele haber NAT y el viaje difiere. El alcance
  IPv4 está implícito pero nunca declarado.
- **Cambio propuesto**: declarar «esta versión muestra solo IPv4» en LEEME y en la etapa.

### A7 · BAJA — HTTP/1.1 sin mencionar ALPN dentro de la aplicación
- **Ubicación**: evento `E10`; etapa `http_solicitud`.
- **Problema**: tras un apretón TLS 1.3 real, cliente y servidor casi siempre negocian
  HTTP/2 o HTTP/3 vía ALPN. LEEME lo admite en «Limitaciones», pero dentro de la
  aplicación (donde está el estudiante) nada lo dice.
- **Cambio propuesto**: una línea en la nota de E10.

### A8 · BAJA — El tramo de vuelta router→equipo nunca se muestra deshecho
- **Ubicación**: eventos `E05`, `E08`, `E11` (respuestas): destino siempre
  `203.0.113.42:40817`.
- **Problema**: las notas dicen que «el router deshace la traducción», pero ningún
  evento muestra el paquete ya retraducido hacia `192.168.1.23:51402`. Refuerza A1: la
  tabla NAT se enuncia pero nunca se ve funcionar en sentido inverso.
- **Cambio propuesto**: en las respuestas, evidencia con «en la LAN: destino
  192.168.1.23:51402» o un evento de estado en el router.

### A9 · BAJA — Bloquear por IP de origen sin mencionar el CGNAT
- **Ubicación**: escenario «intentos fallidos», `E12` y Reto 5.
- **Problema**: se enseña que el servidor cuenta fallos «por dirección de origen». Con
  CGNAT (varios clientes compartiendo una IP pública del operador), bloquear por IP
  castiga a inocentes; es el matiz defensivo estándar que falta.
- **Cambio propuesto**: una frase en E12 o en la explicación del Reto 5.

### A10 · BAJA — Afirmación sobre ECH sin fechar
- **Ubicación**: FUENTES.md, etapa 4 («el ECH … sigue siendo un borrador del IETF en el
  momento de esta versión»).
- **Problema**: afirmación que caduca sin indicar cuándo se escribió; el lector futuro
  no puede evaluarla.
- **Cambio propuesto**: fechar la frase («a fecha 2026-08…») o remitir al estado actual.

## 2 · Datos simulados que podrían confundirse con mediciones reales

### B1 · MEDIA — El ritmo de reproducción comprimido no se declara en la interfaz
- **Ubicación**: `traza.html`, controles de transporte; `app.js`
  (`planificarSiguiente`: espera acotada entre 750 y 2200 ms).
- **Problema**: los instantes están sellados como simulados, pero la *cadencia* de la
  animación no: la reproducción comprime y acota los tiempos (documentado solo en
  LEEME/FUENTES). Quien mire la barra creerá que el DNS «tarda» un segundo largo y que
  los 3,4 s entre intentos fallidos duran lo mismo que los 18 ms del DNS.
- **Cambio propuesto**: etiqueta permanente junto al transporte: «ritmo de reproducción
  comprimido; el instante real simulado es t_ms».

### B2 · BAJA — `generado_en` es el único dato real dentro de una exportación sintética
- **Ubicación**: exportaciones JSON y LOG (`exportarJSON`/`exportarLOG`).
- **Problema**: el campo toma la hora real del equipo. Está documentado en LEEME, pero
  el propio archivo no distingue que ese campo —a diferencia de todo lo demás— sí es una
  medición real. Invierte el error habitual: aquí lo real puede pasar por sintético.
- **Cambio propuesto**: comentario en el `aviso` del documento exportado («generado_en
  es la hora local real de la exportación; el resto es simulado»).

### B3 · BAJA — Las IP del lienzo no llevan marca local de sintéticas
- **Ubicación**: SVG del recorrido (etiquetas bajo cada nodo).
- **Problema**: dependen del sello global de la cabecera; una captura de pantalla
  recortada del lienzo muestra direcciones sin ninguna marca de simulación.
- **Cambio propuesto**: nota al pie dentro del propio panel del recorrido.

## 3 · Casos límite de la interfaz

### C1 · MEDIA — «Exportar» con el contador en 0 exporta los 12 eventos (sondeo P4)
- **Ubicación**: panel «Registro de eventos»; texto «exactamente los del registro de
  arriba».
- **Evidencia**: con el contador en `0 / 12` (ningún evento reproducido), la descarga
  contiene los 12 eventos.
- **Problema**: es el comportamiento documentado (se exporta el escenario completo),
  pero la interfaz mezcla dos nociones de «mostrado»: las filas futuras están atenuadas
  como si no hubieran ocurrido y aun así se exportan. Un estudiante que pause a mitad y
  exporte creerá haber capturado «hasta donde iba».
- **Cambio propuesto**: renombrar los botones («Exportar escenario completo») o exportar
  hasta el índice actual.

### C2 · BAJA — La última etapa nunca se marca «completada» (sondeo P9)
- **Ubicación**: `app.js`, `renderEtapas`: `indiceActual > ultimoIndice`.
- **Evidencia**: al llegar a 12/12, la ficha 06 no recibe la clase `completada`
  (`class=""`).
- **Problema**: cosmético; la condición estricta hace imposible completar la etapa que
  contiene el último evento.
- **Cambio propuesto**: `>=` o marcar todo como completado al agotar los eventos.

### C3 · Sin hallazgo — robustez ante pulsaciones fuera de orden (sondeo P1, P2, P6)
Cambiar de escenario en plena reproducción detiene el temporizador y reinicia el
contador (evidencia: `2/12 → 0/3`, estable tras 1,5 s); avanzar en el final queda
deshabilitado y espacio reinicia limpiamente; 40 pulsaciones rápidas entrelazadas de
flechas no producen errores de consola ni estados fuera de rango. **No se encontraron
defectos en esta subcategoría.**

### C4 · Sin hallazgo — redimensionar durante la animación
El lienzo escala por `viewBox` y la posición del paquete usa coordenadas internas del
SVG; redimensionar la ventana a mitad de transición reescala sin desincronizar. **No se
encontró defecto observable.**

## 4 · Accesibilidad no capturada por las pruebas automáticas

### D1 · ALTA — El registro de eventos destruye el foco del teclado en cada avance (sondeo P3/P3b)
- **Ubicación**: `app.js`, `renderListaEventos` (`lista.innerHTML = ""` en cada render).
- **Evidencia**: tras hacer clic en una fila, el foco cae a `BODY` (el botón pulsado fue
  destruido); con el foco dentro de la lista y la reproducción en marcha, el foco es
  expulsado de la lista en el primer avance.
- **Problema**: una persona que navegue por teclado o con lector de pantalla pierde su
  posición constantemente; es el defecto de accesibilidad más grave del producto.
- **Cambio propuesto**: render diferencial (actualizar clases de las `li` existentes) o
  restaurar el foco al elemento equivalente tras reconstruir.

### D2 · ALTA — Contraste insuficiente en etiquetas significativas (sondeo P5)
- **Ubicación**: `estilos.css`: `.campo dt` y `.etapas .numero` usan `--tinta-4`
  (`rgba(255,255,255,0.32)`); cuerpos de 8,5–9 px.
- **Evidencia**: color computado `rgba(255, 255, 255, 0.32)` sobre superficie `#0b0f15`
  ≈ **2,8:1**, por debajo del 4,5:1 de WCAG 1.4.3 — y son precisamente los rótulos que
  identifican cada dato del inspector («IP ORIGEN : PUERTO», «ESTADO»…), no decoración.
- **Cambio propuesto**: subir esos rótulos a `--tinta-2` (.62) o como mínimo `--tinta-3`
  (.45) con mayor cuerpo; reservar `--tinta-4` para elementos puramente decorativos.

### D3 · MEDIA — Las etapas «no alcanzadas» desaparecen para teclado y lector (sondeo P7)
- **Ubicación**: `app.js`/`estilos.css`: fichas con atributo `disabled` en `fallo-dns`
  (5 fichas).
- **Problema**: `disabled` las saca del orden de tabulación y su explicación vive solo
  en `title`, que los lectores de pantalla no anuncian de forma fiable. El estado «no
  alcanzada», que es contenido didáctico (la lección del escenario es justamente que
  esas etapas no ocurren), resulta inaccesible.
- **Cambio propuesto**: `aria-disabled="true"` manteniendo el foco, más texto oculto
  («etapa no alcanzada en este escenario»).

### D4 · MEDIA — El enlace «saltar al contenido» no mueve el foco (sondeo P8)
- **Ubicación**: `plantilla-traza.html`: `<main id="principal">` sin `tabindex="-1"`.
- **Evidencia**: tras activar el enlace, `document.activeElement` es `BODY`; el
  siguiente Tab vuelve a empezar desde el principio de la página, anulando el propósito
  del enlace en varios navegadores.
- **Cambio propuesto**: `tabindex="-1"` en `<main>` (y opcionalmente `focus()`).

### D5 · BAJA — Anuncios `aria-live` a ritmo de reproducción
- **Ubicación**: `app.js`, `anunciar()` en cada render.
- **Problema**: durante la reproducción automática se emite ≈1 anuncio/segundo durante
  12 eventos; con lector de pantalla activo se solapan o saturan. `polite` mitiga pero
  no resuelve.
- **Cambio propuesto**: anunciar solo en pasos manuales, o resumir («evento 5 de 12»).

### D6 · BAJA — Objetivos táctiles por debajo de 44 px
- **Ubicación**: botones de transporte, fichas de etapa y filas del registro (~30–34 px
  de alto en móvil).
- **Problema**: por debajo del mínimo recomendado (WCAG 2.5.8 / guías de plataforma);
  relevante porque el producto declara soporte móvil (390×844).
- **Cambio propuesto**: aumentar `padding` vertical en `max-width: 640px`.

### D7 · BAJA — El estado del lienzo solo llega por el anuncio textual
- **Ubicación**: SVG `role="img"` con `aria-label` estática.
- **Problema**: qué nodos están activos y hacia dónde va el paquete no se refleja en la
  descripción accesible; el usuario de lector depende del resumen del evento (aceptable,
  pero conviene documentar esa decisión en LEEME).

## 5 · Requisito de funcionar sin conexión

### E1 · MEDIA — Descargas bajo CSP `default-src 'none'` verificadas solo en Chromium
- **Ubicación**: meta CSP de `traza.html`/`pruebas.html`; exportaciones vía `blob:` +
  `<a download>`; LEEME («Cómo abrirlo»: «cualquier navegador de escritorio moderno …
  Chrome/Chromium, Edge, Firefox, Safari»).
- **Problema**: la interacción entre esa CSP restrictiva y las descargas `blob:` se ha
  comprobado únicamente en Chromium (la propia LEEME lo confiesa, pero al final, en
  «Limitaciones», mientras que «Cómo abrirlo» promete sin matices). Si Firefox o Safari
  bloquean la descarga bajo esta CSP, la funcionalidad de exportación —requisito del
  producto— fallaría exactamente donde se prometió que funcionaría.
- **Cambio propuesto**: verificar en Firefox y Safari (o WebKit/Gecko automatizados) o
  trasladar el matiz a «Cómo abrirlo».

### E2 · Sin hallazgo — autocontención
Cero peticiones de red observadas en todos los flujos del sondeo y de la verificación
original; sin fuentes remotas, sin almacenamiento persistente, sin `fetch`/XHR/WebSocket
en el código; la CSP bloquea por defecto todo lo demás. **En esta categoría no se
encontró nada que rompa el requisito.**

---

## Tabla resumen

| Id | Severidad | Categoría | Título corto |
| --- | --- | --- | --- |
| A1 | ALTA | Contenido | DNS con IP privada sin NAT |
| D1 | ALTA | Accesibilidad | Foco destruido por el re-render de la lista |
| D2 | ALTA | Accesibilidad | Contraste 2,8:1 en rótulos del inspector |
| A2 | MEDIA | Contenido | Certificado TLS 1.3 mostrado como legible |
| A3 | MEDIA | Contenido | `WWW-Authenticate: Form` inventado |
| A4 | MEDIA | Contenido | ISN TCP no aleatorios |
| A5 | MEDIA | Contenido | DoH/DoT omitidos |
| B1 | MEDIA | Sim/real | Ritmo comprimido no declarado en interfaz |
| C1 | MEDIA | Casos límite | Exportar en 0/12 exporta todo |
| D3 | MEDIA | Accesibilidad | Etapas `disabled` invisibles al lector |
| D4 | MEDIA | Accesibilidad | Salto al contenido sin mover el foco |
| E1 | MEDIA | Sin conexión | Descargas+CSP sin verificar fuera de Chromium |
| A6–A10, B2, B3, C2, D5–D7 | BAJA | varias | ver detalle |

Categorías declaradas limpias: C3 (controles fuera de orden), C4 (redimensionado), E2
(autocontención). Todo lo demás queda pendiente de corrección en una versión futura;
ninguno de los hallazgos se ha tocado en los archivos entregados.
