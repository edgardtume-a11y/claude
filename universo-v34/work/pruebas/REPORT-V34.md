# REPORT V3.4 — UNIVERSO SEBAS GRANDA
VERSION 1.4.0 · BUILD 20260827-V34-01 · 2026-08-27
Base auditada: 1.3.0 / 20260820-V33-01 (SHA-256 del ZIP original:
`c373b66362a11b4a7a75a3419e05bf5d1ecf8f8bf05e6742cfd56818f0cdc410`).
Los 26+9 screenshots de evidencia son WebGL real (Chromium + SwiftShader,
servidor HTTP local, ruta de misión real vía `?qa=v34`): carpeta
`qa-evidence/` del paquete PRODUCTION.

## 1. POR QUÉ LA TIERRA SE VEÍA COMO UNA FRANJA (causa raíz real, no síntoma)
`_yawPitchGoal(pos …)` recibía en varios call sites EL MISMO objeto
`this._tmpV` como `pos` y luego escribía el punto de mira dentro de
`this._tmpV` antes de `Matrix4.lookAt(pos, target, up)` → eye y target eran
el mismo punto → lookAt degeneraba a identidad → el pitch calculado por
`_pitchForLimb` (−24.7° para poner el limbo al 55 % del encuadre) se perdía y
la cámara miraba al horizonte: la Tierra quedaba abajo, reducida a una
franja. FIX: la función copia el eye a `_goalPos` ANTES y nunca vuelve a leer
el `pos` potencialmente aliased. Verificado en runtime: coverage 12 % → 55 %.

## 2. TRUE EARTH — ASSETS REALES
- `assets/earth/`: day 4096×2048 + 2k, night 4096×2048 + 2k, clouds 2048×1024
  (+1k), `assets/moon.jpg`. Fuentes, licencias, fechas y pipeline exactos en
  `ASSET-CREDITS.md §1` (derivados oficiales de imaginería NASA de dominio
  público; los hosts NASA directos están bloqueados por el egress del entorno
  de build — bloqueo documentado, jamás se fingió la descarga).
- Carga por tier (`celestial.loadOptionalTextures`): ULTRA/HIGH → 4K,
  PERF/MOBILE/SAFE → 2K; `?v=BUILD` (cache busting §177); por-mapa en cuanto
  decodifica; fallback procedural intacto (SAFE/offline/archivo corrupto).
- Máscara oceánica DERIVADA del day.jpg real en runtime
  (`celestial.deriveOceanMask`) → el glint cae exactamente sobre los océanos
  de la imagen. Marcada 'file' para que ningún pase procedural la pise.
- Worker procedural: si los tres mapas reales ya cargaron, el pase HI
  procedural se OMITE (§130) — `earthWorkerState: skipped-file-assets`.
- QA debug imprime `EARTH DAY=FILE NIGHT=FILE CLOUDS=FILE RES=4096` (§128).

## 3. BUG "NUBES EN BLOQUES" EN VISTA LEJANA (precisión de profundidad)
Con `near=0.1 / far=30000`, a ~6000 unidades la cuantización del z-buffer
(~15 unidades) superaba los 11 que separan el cloud shell (R+11) de la
superficie (R): las nubes perdían el depth-test por parches → bloques
oscuros sobre el disco. FIX: near dinámico — 0.1 en superficie, 2.0 en
espacio/hub (precisión ×20). También se blindaron los `pow(1−|d|, n)` de los
shaders con `max(0.0, …)` (base negativa = comportamiento indefinido GLSL).

## 4. MACH 1 — COHETE DOBLADO (causa raíz) Y WHITEOUT
- Doblado: el uniform `uHeat` del post (refracción térmica LOCAL del plume)
  solo se actualizaba en `_surfaceUpdate()`; al pasar al espacio quedaba
  CONGELADO con su centro en pantalla → una región fija seguía refractando y
  doblaba el fuselaje. FIX: reset en `_whiteoutToSpace()` + decay global
  fuera de superficie. Evidencia: `06_mach1.png` — fuselaje recto.
- Whiteout: flash del cloud-punch 0.68/420 ms → 0.52/360 ms; la cúpula del
  cielo ahora OSCURECE con la altitud (uDay·(1−altK), uCloud→0, §94/§95) y la
  rampa azul→cobalto→navy empieza antes; CHASE se acercó (fov 40, z −46) —
  el cohete se mantiene legible en el evento.

## 5. CÁMARAS
- `frameSphere(center, radius, coverage, dir, fov)` (§26) + QA numérico
  `earthScreenCoverage` (§27) visible en `?debug=1` y usado en la evidencia.
- EARTH HERO: limbo al 55 % → coverage 55 % (objetivo 45-65 %) con
  continentes/océano/nubes/atmósfera y terminador (14/15/16).
- EARTH ORBIT CAMERA (§31-32): el modo 'orbit' en órbita ahora orbita EL
  PLANETA (target earthCenter, drag orbital amortiguado, rueda = dolly,
  min earthR+90, max earthR·5.5, seed sin salto desde la cámara actual).
- FREE SPACE (P0 §33-38): la caja x±70/y−90..30/z±40 FUE ELIMINADA. Vuelo
  6DOF real (WASD+QE, vuela-hacia-donde-miras, SHIFT boost), esfera segura
  earthR+60 (proyección sin jitter), envolvente exterior earthR·6 (disco
  completo con espacio, sin bugs de precisión).
- FOCUS EARTH (X), RESET VIEW (R), LOCATE HOME (H): interpolación de
  orientación real (nunca teleport), marcador `HOME // MEDELLÍN` discreto
  vía `latLonToEarthVector()` con fade automático.
- DEPARTURE (§41-42): la cámara recorre un camino real hasta (0,1460,3450) —
  60 %→45 %→32 %→disco completo. La Tierra NUNCA se escala (§42);
  es perspectiva. QA: dep25/dep50/depfull + evidencia 20/21/22.

## 6. COUNTDOWN CON VOZ (P0 §53-59)
- VISUAL: dígitos 5·4·3·2·1 gigantes centrados (clamp 120-280 px, font-d,
  animación pop, reduced-motion la desactiva). Evidencia 02/03.
- VOZ: `SpeechSynthesis` LOCAL (sin red, sin API keys, §58). ES prefiere
  es-CO → es-419/es-MX → es-ES → es; EN en-US → en. "Cinco…uno, Ignición,
  Despegue" / "Five…one, Ignition, Liftoff". Mission Control: autorización,
  Mach uno, máxima presión dinámica, separación de etapa, inserción orbital —
  precedidas de squelch de radio (§59, la síntesis no puede enrutarse por
  WebAudio, así que la textura de radio la da el squelch).
- Fallbacks: sin voz → beeps + visual (el lanzamiento NUNCA se rompe, §57);
  SOUND OFF cancela también la voz al instante (§105). En el entorno QA
  headless no existe SpeechSynthesis → se verificó la RUTA DE CÓDIGO y el
  fallback; la voz audible requiere un navegador real (documentado en
  QA-V34.md — es el único punto no verificable audiblemente aquí).

## 7. FACILITY / IGNICIÓN
- Valle (§72-73): dos crestas-silueta lejanas con desplazamiento por ruido y
  color aéreo (near→mid→far). Losas del borde re-tonalizadas (sin parches
  flotantes de día), gris de nubes del domo reducido.
- Conos de luz volumétricos en los 4 flood posts (noche, opacidad ligada a
  bruma §74/§169); mástil pararrayos 62 m con guy-wires y baliza roja (§69);
  casco del cohete a 1024 px con desgaste escalado (§66/§168).
- Ignición (§76-82): chispas de hold-down + anillo de polvo en T-0 sobre el
  sistema existente (deluge, vapor, core/plume/outer/smoke iluminados desde
  el punto de ignición, luces de rebote, trauma de cámara).
- QA FACILITY HERO: encuadre bajo/cercano — cohete dominante, torre
  enmarcando (§166).

## 8. GALAXY HUB V3.4 (adicional completo)
- TRES MORFOLOGÍAS REALES: G01 doble-corriente elongada energética (anillos
  orbitales finos, anillo-pulso animado, streaks radiales girando rápido);
  G02 GRAN ESPIRAL HERO (R 250, 4 brazos, bulge, halo estelar, 6 regiones
  magenta de formación estelar, clusters azules, dust lanes tallados, giro
  majestuoso 0.011); G03 BARRADA dorada (barra central, brazos desde los
  extremos, anillo sutil, red de nodos con conexiones intermitentes, giro
  inverso preciso). Distinguibles EN SILUETA (evidencia 29/30/31).
- Posiciones X/Y/Z reales: (−470,170,−640) / (30,−70,−1060) / (460,60,−500)
  con inclinaciones y escalas distintas — la fila de menú no existe.
- RECTÁNGULO STAR MARK ELIMINADO (causa: `nebulaTex()` repartía blobs por
  todo el canvas → bordes visibles del sprite; ahora falloff radial + máscara
  dura a cero antes del borde).
- TELEMETRÍA (adicional §6): `SG-L1 // DEEP SPACE · NAV // GALAXY HUB ·
  DRIVE // STANDBY · SIGNAL // STABLE` — la telemetría de ASCENT ya no
  sobrevive al salto (fix también del panel SYSTEMS pegado vía SALTAR VIAJE).
- LLEGADA (adicional §2/§48/§49): 9 s la primera vez (exposición 0.42→1.02,
  deriva de cámara desacelerando, nombres/paneles ocultos), 3.2 s en visitas
  posteriores; tap después de 2 s la salta; autotest/reduced-motion la omiten.
  Al liberar: banner, hint, anchors, SG.OS.
- PROFUNDIDAD (adicional §18-22): foreground de polvo cercano (parallax
  fuerte), nave (capa 2), héroes (capa 3), 5 campos de nebulosa con fade
  radial a AMBOS lados de las galaxias (el gas se atraviesa), 8-10 galaxias
  de fondo variadas (edge-on incluidas), starfield profundo. Cámara libre
  del hub con W/S/Q/E reales, límites y exclusión de núcleos (§47).
- NAVE (adicional §29-30): siempre presente; al SELECCIONAR: RCS + el morro
  se orienta al destino + línea de ruta tenue; al CONFIRMAR la ruta se
  intensifica y el push de cámara existente completa la secuencia.
- BLACK HOLE (adicional §34-36): uno, lejano (−860,320,−1750), disco de
  acreción fino contrarrotante + glow mínimo; SCAN → "ANOMALY DETECTED —
  CLASSIFICATION // UNKNOWN". Sin enlace, sin página, sin cuarta opción.
- URLs y LITE intactos (verificado contra `config.js` — no se tocaron).

## 9. ORBITAL SUNRISE (§44)
Evento sobre el `_heroSun` compartido (§171 — un único Sol para superficie,
nubes, atmósfera, nave y key light): noche → borde rojo fino → naranja →
rim azul → sol blanco → superficie, 14 s, con dip/recuperación de exposición.
Disparo natural si el visitante permanece en PRE-WARP >21 s; QA `sunrise`.

## 10. REPOS ESTUDIADOS / DEPENDENCIAS
- Estudiados como referencia (sin copiar código, sin instalar):
  bobbyroe/threejs-earth, vasturiano/three-globe (arquitectura de capas y
  day/night — además fuente de imaginería NASA-derived, ver créditos),
  NASA Eyes (filosofía de navegación), three.quarks (§84: evaluado — el
  sistema de partículas propio con luz de ignición cumple; no se añadió),
  AmitDigga/threejs-galaxy-shader y ggwzrd/threejs-galaxy (distribución
  espiral/twist — la implementación V3.4 es propia sobre Points+Buffer),
  glTF-Transform/meshoptimizer (no aplican: no se introdujeron GLB),
  NASA 3DTilesRendererJS (§118: descartado explícitamente para V3.4).
- DEPENDENCIAS AÑADIDAS: CERO. Three.js sigue en r161 (§4/§119), ahora
  LOCAL en `vendor/three.module.js` (build oficial npm, MIT) + CDN fallback.
  Fix del loader: fetch e import resolvían rutas distintas ("/vendor" vs
  "/js/vendor") — el vendor local jamás podía cargar aunque existiera.

## 11. PERFORMANCE / BROWSERS / SCREENSHOTS / PENDIENTES
- Ver `PERFORMANCE-V34.md` (medido, no estimado) y `QA-V34.md` (PASS/FAIL
  con evidencia por punto, incluidos los criterios de FAIL §188-§193).
- Chromium (headless SwiftShader) verificado end-to-end; Firefox/Safari no
  disponibles en este entorno — NO se declaran PASS (§153); el diseño usa
  APIs estándar (WebGL1/2, Web Audio, SpeechSynthesis con fallback).
- Pendientes reales (honestos): voz audible verificada solo por ruta de
  código (entorno sin audio); Safari/Firefox sin prueba directa; Deep Star
  Map SVS no incluido (decisión documentada); GLB hero slots siguen vacíos
  (contrato procedural vigente).
