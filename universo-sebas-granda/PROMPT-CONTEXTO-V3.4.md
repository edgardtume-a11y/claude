# PROMPT DE CONTEXTO — UNIVERSO SEBAS GRANDA V3.4
(Pega este bloque completo al inicio de cualquier sesión futura de trabajo
sobre el proyecto. Resume TODO lo construido y arreglado hasta la V3.4.)

---

## QUÉ ES EL PROYECTO

`UNIVERSO SEBAS GRANDA` — experiencia web cinematográfica en Three.js **r161**
(sin build, módulos ES nativos, vendor local + CDN fallback) desplegada en
`https://sebasgrandamanager.starmarkagencia.com/pruebas/`.

Misión completa: INTRO multilingüe → LLEGADA a la SG Aerospace Launch
Facility (Medellín, 6.2442 N / −75.5812 W, clima y cielo astronómico REALES)
→ COUNTDOWN → LANZAMIENTO → MACH 1 → MAX-Q → MECO → STAGE 1 SEPARATION →
STAGE 2 → FAIRING SEP → ÓRBITA (Tierra NASA real) → EARTH DEPARTURE → WARP →
GALAXY HUB con 3 galaxias-destino:
1. CONÓCEME EN 60 SEGUNDOS → /inicio
2. SEBAS GRANDA → /sebas
3. STAR MARK AGENCY → starmarkagencia.com
Hub: 1 clic = seleccionar · doble clic / segundo tap = entrar · CTA del panel
confirma. NUNCA romper esa lógica.

## ARQUITECTURA (build 20260820-V34-01, v1.4.0)

- `index.html` — shell + importmap con `?v=BUILD` (cache-busting en TODO)
- `js/main.js` — boot, loader de three (vendor→CDN), welcome, LITE fallback
- `js/experience.js` — el motor (~6300 líneas): capítulos, cámaras, partículas,
  post propio (SGPost: bloom selectivo, grading, heat haze), Tierra, hub
- `js/celestial.js` — catálogo estelar real, Vía Láctea, Luna, Tierra
  procedural (SOLO fallback) + `loadOptionalTextures` (NASA por tier)
- `js/astronomy.js` — Sol/Luna/planetas reales (Meeus), GMST
- `js/countdown-voice.js` — voz del countdown (NUEVO V3.4)
- `js/qa34.js` — modo QA `?qa=v34` (NUEVO V3.4)
- `js/audio.js` — WebAudio 100 % procedural · `js/ui.js` — HUD
- `vendor/three.module.js` — three 0.161.0 oficial INCLUIDO (MIT)
- `assets/earth/source/` — originales NASA · `assets/earth/runtime/` —
  day/night 4096-2048-1024.jpg, clouds-alpha-2048/1024.png (alfa real),
  spec-1024.png (blanco=agua)
- Docs: AUDIT-V34.md · ENTREGA-V3.4.txt (informe 20 puntos) ·
  ASSET-CREDITS.md §6 (fuentes NASA + SHA-256) · THIRD-PARTY.md

## LO QUE V3.4 CONSTRUYÓ

1. **TRUE EARTH**: EarthRoot (esfera 3D real R=1400 en centro (0,−1620,−180))
   con capas EarthSurface (Blue Marble sRGB, especular+glint SOLO océanos vía
   máscara real), NightLights (dot(N,sunDir)+smoothstep del terminador, jamás
   50/50), Clouds (shell R+11, alfa NASA real, rotación propia), Atmosphere
   Fresnel, Airglow, EarthAurora polar (HIGH/ULTRA, alfa ≤0.085), marcador
   discreto HOME//MEDELLÍN (auto en hero orbital + LOCATE HOME en photo/QA).
   Resolución por tier: HIGH/ULTRA 4096 · PERF 2048 · MOBILE 1024. La misma
   Tierra se ve desde director/orbit/free/photo/QA.
2. **Encuadre matemático**: `frameSphereDistance(coverage,fov)` (exacto, con
   tangentes) + `earthScreenCoverage()` (% vertical en vivo, modo DISC/LIMB)
   como criterio de aceptación. Targets: cloud break 12–17 % · Mach1/Max-Q
   26 % · strato 34 % · ORBIT HERO limb 55 % · departure 55→45→32 % → disco
   completo 52 % con espacio alrededor.
3. **Countdown con voz**: 5-4-3-2-1 GIGANTE centrado + T-0n debajo; voz por
   prioridad: clips locales (assets/audio/voice/ + manifest.json, slots
   documentados) → SpeechSynthesis (es-CO→es-419→es-US→es-MX→es-ES / en-US,
   pitch 0.92) → beep+texto. Squelch de radio antes de cada número.
   "IGNICIÓN" en T-0, "DESPEGUE" en T+0.78. Timeline: T-5 luces torre · T-4
   vapor criogénico · T-3 water suppression standby · T-2 umbilical · T-1
   cámara HERO + pre-ignition glow · T-0 ignición · liftoff LENTO y pesado.
4. **Mach 1 / Max-Q distintos**: Mach 1 = cono de condensación (~1.2 s) +
   shock collar + shake + audio.stress + banner. Max-Q = vibración más grave
   sostenida + throttle-bucket visual del plume (−32 %) + telemetría DYNAMIC
   PRESSURE MAX. El fuselaje SIEMPRE recto.
5. **Free camera orbital**: límites por earthR (centro ∈ [R+70, 3.4R], jamás
   dentro del planeta), nace SIEMPRE mirando la Tierra, W/S vuelan a lo largo
   de la mirada, velocidad escala con altitud, **F = FOCUS EARTH** (rotación
   suave 0.7 s conservando posición), **R = RESET ORBIT VIEW**. En el resto de
   modos F sigue siendo el scanner.
6. **Photo mode orbital**: target TIERRA/NAVE, LOCATE HOME, satélites on/off,
   reset cam; la cámara nunca entra en la esfera.
7. **Earth Departure real** (8 s): la cámara recorre una radial + swing a ¾
   por DISTANCIA (cero scale), la nave viaja delante con burn visible,
   telemetría de alejamiento; termina en disco completo antes de ACTIVAR WARP.
8. **QA `?qa=v34`** (+ `&jump=<beat>` para automatizar): saltos por el CÓDIGO
   REAL a countdown5/1, ignition, liftoff, mach1, maxq, stagesep, stage2,
   fairing, cloudbreak, stratosphere, earthhero, freecam, dep25/50/100, warp,
   hub — con pin de reloj determinista anclado al capítulo destino; readout
   EARTH SCREEN COVERAGE + DAY/NIGHT/CLOUDS/SPEC=FILE (ERROR si HIGH/ULTRA
   usa procedural); toggles de capas; VOICE 5-4-3-2-1; window.__QA34 y
   window.__SG_EXP para Playwright.

## LOS BUGS QUE V3.4 ENCONTRÓ Y ARREGLÓ (memorizar — no reintroducir)

- **EL BUG MADRE**: `_yawPitchGoal()` recibía `pos===this._tmpV` y lo
  sobrescribía como target → lookAt(eye===target) degenerado → pitch/yaw
  SIEMPRE 0 → todas las cámaras Earth-aware miraban al frente y la Tierra
  quedaba fuera de pantalla. Fix: eye=_goalPos (copia) + target en vector
  propio (_tmpVLook). NUNCA volver a pasar _tmpV como pos a _yawPitchGoal.
- **Mach 1 doblado**: el heat haze (uHeat del composite) solo se actualizaba
  en _surfaceUpdate; al pasar a espacio quedaba CONGELADO deformando el
  cohete. Fix: uHeat=0 en _whiteoutToSpace + decay global en _worldUpdate +
  máscara anisotrópica solo AIRE bajo la tobera (smoothstep en uv.y−uHeatC.y).
- **Departure sin disco**: el path viejo acababa a d≈2832 donde el disco no
  cabía en el fov — la rama full-disc era inalcanzable. Fix: distancias por
  frameSphereDistance hasta ~5700.
- **vendor/three jamás se importaba**: import('./vendor/…') resolvía relativo
  a js/ (404 silencioso → siempre CDN). Fix: URL anclada a document.baseURI.
- **audio.uiSelect() no existía** → TypeError en _fairingSep. Fix: añadido.
- **skipFlight no aceptaba 'facility'** → la opción IR AL GALAXY HUB del
  welcome era un no-op. Fix: añadido a la lista.
- **La Tierra fotobombardeaba el warp** (ahora que es brillante). Fix:
  gSpace.visible=false en _engageWarp.
- **Z-fighting en bloques** nubes↔superficie a distancia (near 0.1 + far
  30000 → precisión ~15 unidades a d=5000 > separación 11). Fix: near plane
  ADAPTATIVO — 0.1 en superficie, 2.0 en espacio (_cameraUpdate).
- **Clouds-alpha**: derivar de luminancia de paleta desviaba 77 % de los
  píxeles — usar SIEMPRE el canal alfa real del PNG NASA.
- **Rampa uSpace saltable** con frames lentos → cielo diurno pegado en
  órbita. Fix: _enterOrbit idempotente (uSpace=1, clearColor, haze=0).
- **spec como JPG** metía bloques en el glint → es PNG.

## ESTADO DE VERIFICACIÓN (2026-08-20)

- 15/15 capturas obligatorias (qa-captures-v34/) vía Playwright + Chromium/
  SwiftShader real, 0 errores JS, texturas FILE en todas.
- `?autotest=1`: FULL MISSION PASS (incluida la suite completa de UX del hub).
- Verificación adversarial (12 revisores independientes): 11/11 criterios NO
  refutados, 0 bloqueantes.
- Coverage medido: HERO 55 % · Mach1 18 % · Max-Q 24 % · Strato 34 % ·
  disco final 52 %.
- Entregables: universo-sebas-granda-V3.4-production.zip y -HOSTING.zip
  (sellos en entregables/SELLOS-V34.sha256).

## REGLAS PERMANENTES DEL PROYECTO

- NO romper el Galaxy Hub (selección/doble clic/CTA/failsafe).
- NO cambiar Three.js de r161 sin razón técnica inevitable y justificada.
- NO hotlinking; todos los assets viven en el ZIP. NASA = dominio público,
  sin logo NASA, sin sugerir afiliación (ASSET-CREDITS.md).
- NO declarar PASS nada que no se haya VISTO renderizado (capturas reales).
- Honestidad §45: si algo no se pudo hacer, documentarlo, no inventarlo.
- Fallbacks siempre: procedural Earth si faltan archivos, beep si no hay voz,
  LITE si no hay WebGL. Cosmético jamás bloquea la misión.
- Voz: cero TTS externo en runtime; ningún dato del visitante sale del
  navegador.

## PENDIENTES OPCIONALES (para V3.4.1/V3.5)

- Cosmético: shock collar volumétrico (hoy elipse billboard), plume del
  departure burn como estela (hoy glow radial), nubes 4096 para primerísimos
  planos.
- Slots vacíos auto-detectados: assets/moon.jpg (CGI Moon Kit), clips de voz
  grabados, modelos hero .glb (rocket/tower/ship), texturas NASA 8K.
- Validación en hardware real del usuario: FPS HIGH (objetivo 55–60), voz
  audible, móvil.
