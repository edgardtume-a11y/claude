# UNIVERSO SEBAS GRANDA
VERSION 1.4.0 · BUILD 20260820-V34-01 — ver `DEPLOY.md` para el protocolo de
despliegue/validación en hosting real, `build.json` como fuente de verdad del
build, y `vendor/README.txt` para colocar Three.js r161 local (un comando).

Experiencia cinemática 3D/4D lista para producción. **No requiere build, npm ni configuración.**
Es un sitio estático: HTML + CSS + módulos ES nativos.

## Pasada visual AAA (v2)

Esta versión incluye una pasada completa de dirección de arte y tecnología en tiempo real:

- **Iluminación nocturna motivada**: jerarquía real de fuentes (ambiente de cielo, Luna real, key industrial de la torre, rellenos cian/blanco técnico/ámbar, rebote urbano del valle). La noche tiene color y profundidad — nunca gris plano.
- **Sombras reales** en calidades HIGH/ULTRA (PCF suave, una luz proyectora: Sol de día ↔ key industrial de noche) + sombras de contacto en todos los objetos.
- **Cámaras DIRECTOR / ORBIT / FREE** con transiciones suaves (0.45–0.85 s). La cámara libre es total: yaw 360°, pitch −80°..+85°, inercia, FOV con rueda, WASD dentro de la zona segura y colisión con terreno.
- **Cielo real**: Luna con textura y fase real (series de Meeus, halo solo cerca del horizonte, jamás bajo el horizonte), catálogo de ~85 estrellas reales (RA/Dec/magnitud/color) y Vía Láctea generada en coordenadas galácticas reales, todo rotando rígidamente con el tiempo sidéreo y ocultado por nubes/bruma/Luna.
- **Tierra orbital geográfica**: continentes y ciudades reales generados localmente, océano con especular + glint solar, luces nocturnas reales, capa de nubes independiente, dispersión atmosférica aproximada y airglow. **Mejora opcional**: coloca imágenes NASA (dominio público) en assets/ y se usan solas — ver assets/README.txt.
- **Ascenso re-cronometrado**: LIFTOFF→ÓRBITA ≈ 16.6 s con lista de planos (pad bajo → motor → torre → tele → chase → near-body → estratósfera), primeros metros lentos y pesados, MACH 1 con anillo de condensación, MAX-Q breve y espectacular, mar de nubes tras atravesar la cubierta.
- **Cuenta atrás con evento por segundo** (luces de sistema, presurización, brazos umbilicales secuenciales, diluvio, chispas, IGNICIÓN como fuente de luz protagonista).
- **Post-proceso propio** (sin dependencias): bloom selectivo por umbral, ACES + 3 miradas de color (NOCHE TIERRA / ÓRBITA / HUB), viñeta sutil, y aberración cromática + distorsión radial + pulso de exposición **solo** durante el FTL.
- **FTL corto (3.4 s)** con tres poblaciones de estelas y la nave iluminada por el corredor.
- **Galaxy Hub vivo**: galaxias con brazos tallados por polvo, temperaturas estelares, núcleos con profundidad, halos y cúmulos; campos estelares lejanos, motas cercanas, velo nebular y **eventos raros** cada 20–45 s (cometa, streak interestelar, anomalía SG, púlsar, sonda, pulso de lente) — uno a la vez.
- **Observador del usuario**: al sincronizar tu ubicación, el panel LOCAL SKY puede alternar MEDELLÍN ↔ TU CIELO (Sol/Luna/planetas calculados para ti). El mundo 3D permanece narrativamente en Medellín.
- **Calidades reales**: ULTRA/HIGH/PERFORMANCE cambian de verdad resolución de sombras, texturas de Tierra, densidad estelar, partículas y calidad de bloom; AUTO degrada por pasos imperceptibles (DPR → nubes → bloom → post).
- **Audio por capas**: maquinaria del complejo, radio de control lejana, diluvio, crackle+resonancia del motor; el exterior se apaga al llegar al espacio.

## Publicar (hosting estático)

Sube **el contenido de esta carpeta** a la raíz pública de tu hosting (Hostinger, cPanel,
Netlify, Vercel estático, GitHub Pages, S3, etc.). Debe quedar así:

```
/ (raíz pública)
├── index.html
├── favicon.svg
├── css/main.css
├── js/  (config, i18n, save, astronomy, weather, audio, ui, experience, main)
└── vendor/  (opcional, ver abajo)
```

Requisito único del servidor: servir los archivos tal cual por **HTTPS** (los módulos ES y
la geolocalización lo requieren). No hay backend, base de datos ni claves.

## Probar en local (opcional)

Los módulos ES no cargan con `file://`. Usa cualquier servidor estático, por ejemplo:

```
npx serve .
```

y abre la URL indicada.

## Three.js (CDN o auto-hospedado)

Por defecto el motor 3D (Three.js r161) se carga desde CDN con doble respaldo
(jsDelivr → unpkg). Para servirlo desde tu propio dominio, descarga
`https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js` y guárdalo como
`vendor/three.module.js`. El código lo detecta y lo prioriza automáticamente.

Si el 3D no está disponible (sin WebGL, CDN bloqueado, error grave), la página entra en
**LITE MODE**: una versión 2D con los tres destinos reales siempre accesibles. Nunca
pantalla negra.

## Parámetros de URL

- `?debug=1` — HUD de métricas + versión/BUILD, pantalla SG RUNTIME ERROR, watchdog con RECOVER, botón de prueba de context-loss.
- `?diag=1` — diagnóstico de red/MIME/BUILD de todos los recursos (P0.1 §19).
- `?safe=1` — SAFE 3D: misión completa con GPU reducida (sin post/bloom/sombras/worker/satélites/eventos raros).
- `?autotest=1` — misión completa sin manos; termina en `[SG TEST] FULL MISSION PASS`.
- `?autotest=skip` — prueba del botón SALTAR INTRO (`[SG TEST] SKIP → FACILITY PASS`).
- `?autotest=1&fail=worker|post|satellites|weather` — inyección de fallos: cada uno debe llegar igualmente al HUB.
- `?autotest=1&fail=webgl` — única ruta legítima a LITE.
- `?lite=1` — fuerza LITE manualmente.
- `?shot=intro|facility|ignition|ascent|maxq|orbit|hub` — modo DEV de comparación artística (V3 §56 / V3.2 §67-§71): automatiza el camino REAL (skip → CTA → …) hasta el encuadre pedido y lo mantiene para revisión; no altera producción.

## V3 — Photoreal + SG MISSION 001 (build 20260820-V3-01)
- **Galaxy Hub UX**: hover siempre previsualiza; el primer click SELECCIONA (cambio libre 01↔02↔03, sin bloqueo); SOLO el CTA del panel navega, con cinemática de confirmación ~1.1 s saltable (Enter/click/reduced-motion). ESC deselecciona.
- **Lanzamiento cinematográfico**: HERO CAM en T−1, lista de planos PAD HERO → ENGINE → TOWER → TELEPHOTO → CLOUD PUNCH, whiteout ≤ ~0.35 s, exposición HDR disciplinada, humo v3 con erosión por ruido (sin billboards idénticos).
- **Hero detail HIGH/ULTRA**: cohete SG-L1 (líneas de alimentación, escotillas, sujetadores, banda térmica, seams), torre densificada, nave SG con antenas/pod/anillo térmico/marcas; pad irregular con drenaje, escaleras y casos de equipo; terreno con erosión, tierra y pista de servicio. PERF/SAFE conservan la versión limpia (fallback §2).
- **Pipeline de assets** (`js/sgassets.js`): slots locales `assets/models/<slot>/<slot>.glb` con parser GLB propio y soporte automático de GLTFLoader/DRACO/KTX2/Meshopt si colocas los addons en `vendor/three-addons/`. Ver `assets/models/README.txt` y `ASSET-CREDITS.md`.
- **SG MISSION 001 (capa narrativa)**: boot diegético + VISITOR DETECTED, objetivo único por momento (LLEGA A LA INSTALACIÓN → … → ELIGE TU DESTINO), dron guía **SG-01** (contacto por escáner o mirada ~1.5 s), hotspots integrados al escáner con tarjetas MORE INFO, 3 secretos + `CLASSIFIED ACCESS GRANTED`, HUD contextual en primera visita (SCAN primero; CAM/FOTO/MAP aparecen cuando sirven), Photo Mode v2 con presets NATURAL / MISSION FILM / DEEP SPACE y postcard `MISSION 001`, Mission Log con checklist de estado, visitante recurrente con CONTINUAR / REPETIR LLEGADA / IR AL GALAXY HUB, notas de eventos celestes reales. El golden path (90 s–2.5 min) nunca se bloquea por secretos ni descubrimientos.
- **Futuro**: `docs/FUTURE-FLIGHT-MODE.md` (documentado, no implementado por prioridad §64).

## V3.3 — Real Staging + Earth Departure + Galaxy UX (build 20260820-V33-01)
- **Cámara Earth-aware**: fuera los pitch mágicos — `_limbAngle/_pitchForLimb/_earthAngRadius` calculan por frame dónde está el limbo real (centro (0,−1620,−180), R 1400) y colocan el horizonte en la FRACCIÓN pedida del encuadre por rig: TRACK 10 %, CHASE 16 %, MAX-Q 22 % (curvatura inequívoca con superficie/océano/nubes, no banda naranja), STRATO 34 %; estable en 16:9/ultrawide porque depende de FOV vertical, no de resolución.
- **SG-L1 de DOS ETAPAS reales desde la plataforma**: grupos independientes `mStage1` (booster 17 u + interstage + 5 toberas + 2 luces de marcador), `mUpper` (upper 8 u + tobera de vacío + glow azul) y `mFairL/mFairR` (mitades de carenado). Secuencia: **15.2 MECO → 15.8 STAGE 1 SEPARATION** (impulso relativo, cae atrás, rota lento, conserva luces, sin explosión, sale de cámara; HUD `STAGE 1 // SEPARATION` + golpe mecánico seco) → **16.6 STAGE 2 IGNITION** (motor más fino, HUD) → **17.4 FAIRING SEPARATION** (mitades con impulso lateral opuesto, rotación lenta, cull lejos) → **18.8 ORBIT INSERTION** limpio.
- **Orbit cleanup**: las «piezas blancas» sobre la nave eran la vieja animación de fairing-open del capítulo órbita (V3.2, evento 1.2 s) — eliminada; la upper stage ahora deriva hacia atrás y se culla; el hero muestra nave + Tierra + espacio.
- **Hero orientado a América**: al whiteout se calcula la dirección de superficie de Medellín (6.2442, −75.5812) y se orienta el globo para que el primer reveal muestre hemisferio occidental, océano y nubes; al entrar al Hub vuelve la rotación GMST real.
- **EARTH DEPARTURE (nuevo beat)**: `SG DEPARTURE BURN` en órbita 4.4 s — burn azul fino, la cámara se retira por una curva Earth-aware (60 % → 45 % → 30-35 % → disco completo con la nave pequeña), `EARTH DEPARTURE COMPLETE` + `INTERSTELLAR DRIVE READY`, y SOLO entonces aparece `ACTIVAR WARP` — nunca sobre una franja naranja.
- **Galaxias — doble clic real**: autoridad por `lastGalaxyTapIndex/lastGalaxyTapTime` (<420 ms sobre la MISMA galaxia = `galaxyConfirm`), independiente de que el anchor se mueva tras el dolly; `dblclick` DOM y doble toque táctil como respaldo; clic en vacío y ESC deseleccionan por la misma vía; otras galaxias siempre clicables; dolly limitado ~8-12 %; confirm cinemático 700-1000 ms; **failsafe 2.1 s** restaura CTA e interacción si la navegación no descargó la página; hint una sola vez `1 CLIC — SELECCIONAR · DOBLE CLIC — ENTRAR` (variante táctil).
- **Hub polish sin rediseño**: bloom de la galaxia dorada domado (~×0.68 núcleo/halo) para ver partículas, +7 % de escala en la seleccionada, anillo de selección pulsante, capas/parallax existentes conservados.
- **QA**: `?shot=stageSep|stage2|fairing|earthDeparture25|50|100|galaxySelected` con el reloj de capítulo fijado en el instante exacto; botones `?debug=1` STAGE SEP · FAIRING SEP · EARTH HERO · EARTH DEPARTURE · SELECT GALAXY 1 · DOUBLE CLICK GALAXY 1; overlay muestra `EARTH DAY/NIGHT/CLOUDS=` (FILE solo con NASA local — ver ASSET-CREDITS §5).

## V3.2 — Multilingual Intro + Cinematic Ascent + Earth Reveal (build 20260820-V32-01)
- **Intro multilingüe legible**: 22 saludos verificados (14 en móvil) en composición RADIAL controlada — anillos con ángulo áureo, márgenes seguros, zonas de UI reservadas, exclusión del núcleo y relajación de separación mínima; tracking por escritura (árabe/devanagari sin separación, CJK natural, latín amplio), blur ≤0.5 px, opacidad 0.62–1.0, halo oscuro por palabra + atenuación ~30 % de partículas detrás del texto. Convergencia §13: cada palabra se curva, se estira y se fragmenta en puntos que viajan al centro. Timing 0–0.7 aparición · 3.8 convergencia · 5.0 singularidad · 5.4 flash · 6.4 título. SALTAR INTRO intacto.
- **Countdown vivo (§17)**: cada segundo dispara algo — TOWER SYSTEMS · PRESSURIZATION · CRYO VENT · PAD LIGHTING/UMBILICAL · deluge · ignición.
- **Motor en 3 capas (§19-§20)**: CORE casi blanco diminuto, PRIMARY blanco→ámbar turbulento, OUTER gas azul-gris transparente en expansión; variación real de tamaño/vida/velocidad/color. **Heat haze local (§21-§22)**: pase propio en el composite (ruido animado enmascarado al motor), ULTRA/HIGH activo, PERF/SAFE apagado.
- **Salida del planeta (§26-§31)**: whiteout ≤ ~0.42 s con silueta legible; cielo azul→cobalto→navy→casi-negro→negro espacial con estrellas apareciendo antes; encuadres reencuadrados — MAX-Q con horizonte CURVO en el cuarto inferior y cielo oscuro arriba (sin Tierra completa), STRATO lateral con la Tierra ≈ ⅓. **MECO (§32-§33)**: corte brusco de pluma + resplandor residual + silencio súbito ~1.4 s de coasting.
- **Earth reveal (§45-§52)**: en órbita la Tierra ocupa ~45-50 % de la altura y se recorta por abajo (escala); 2.3 s de hero sin HUD (solo telemetría crítica + SALTAR VIAJE) → línea pequeña «ÓRBITA TERRESTRE ALCANZADA» → nave SG → SCAN/CAM/FOTO regresan escalonados. Capa Tierra ya bobbyroe-style: día/noche geográficos, luces solo en lado nocturno, glint oceánico, terminador cálido, cloud shell independiente, atmósfera Fresnel + airglow.
- **Audio (§61)**: atenuación en nubes, motor adelgazando en estratosfera, MECO = quiet repentino, ambiente interior en órbita.
- **Aceptación (§80)**: la cadena de autotest añade IGNITION · LIFTOFF · CLOUD BREAK · MAX-Q · STRATOSPHERE · MECO · SHIP REVEAL PASS.
- **Referencias técnicas** (bobbyroe/threejs-earth, three-globe, three-fluid-fx, takram, docs oficiales) estudiadas y adaptadas sin dependencias nuevas: `THIRD-PARTY.md`.

- `?lite=1` fuerza LITE MODE.
- `?debug=1` muestra el overlay técnico (fps, capítulo, clima, fuente de datos).

## Datos y honestidad

- **Clima real** de Medellín vía Open-Meteo (sin clave). El HUD marca la fuente:
  `LIVE`, `CACHED` (≤6 h) u `OFFLINE`. Nunca se etiqueta como LIVE un dato que no lo es.
- **Astronomía real** (sol, luna con fase, Venus/Marte/Júpiter/Saturno) calculada en el
  dispositivo para la hora actual de Medellín.
- Progreso local (idioma, descubrimientos 17/17, avistamientos, misiones, último destino)
  en `localStorage`, versionado. `RESET DATA` en CONTROL CENTER lo borra con confirmación.
- No hay datos inventados de portafolio: las tres galaxias enlazan solo a las URL reales.

## Destinos (inmutables)

1. GALAXY 01 — CONÓCEME EN 60 SEGUNDOS → https://sebasgrandamanager.starmarkagencia.com/inicio
2. GALAXY 02 — SEBAS GRANDA / MI MUNDO COMPLETO → https://sebasgrandamanager.starmarkagencia.com/sebas
3. GALAXY 03 — STAR MARK AGENCY → https://starmarkagencia.com

## Controles

Arrastrar: mirar/orbitar · Rueda o pellizco: zoom · **F** escáner (en móvil, botón SCAN) ·
**C** cámara · **P** modo foto (captura con marca de agua) · **ESC** cierra paneles ·
Gamepad compatible (stick derecho mirar, A acción, X escáner, LB/RB cámara).

`.env.example` documenta banderas opcionales (terreno real preparado pero desactivado);
ninguna variable es necesaria para producción.


### Verificación de misión (P0)
- `?autotest=1` — recorre la misión completa sin tocar nada e imprime en consola `[SG TEST] … PASS` por capítulo y `FULL MISSION PASS` al llegar al Galaxy Hub.
- `?debug=1` — métricas en vivo, volcado de estado ante el primer error, watchdog de capítulos y botón `RECOVER TO NEXT SAFE STATE` si una fase automática excede su presupuesto.
- La generación de la Tierra ya no bloquea el hilo principal: LOD inmediato + Worker (`js/earthworker.js`) con fallback troceado. Si colocas texturas NASA locales (ver `assets/README.txt`), siempre tienen prioridad.
