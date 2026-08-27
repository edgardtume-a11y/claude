# AUDIT V3.4 — UNIVERSO SEBAS GRANDA
Fecha de auditoría: 2026-08-27 · Auditado sobre el ZIP entregado (SHA-256
`c373b66362a11b4a7a75a3419e05bf5d1ecf8f8bf05e6742cfd56818f0cdc410`, 193 122 bytes)
Versión encontrada: **1.3.0 · BUILD 20260820-V33-01** (coincide con la huella esperada).

Esta auditoría se hizo leyendo el código real de esta entrega, no copiando
reportes anteriores.

## 1. RENDERER
- Three.js **r161** inyectado (`createExperience(three, …)`); loader en `main.js`:
  `vendor/three.module.js` primero (validado >100 KB y no-HTML), CDN pinneado como fallback.
  **HALLAZGO P0: `vendor/three.module.js` NO está en el ZIP** → producción dependía de CDN.
- `WebGLRenderer` antialias (excepto mobile), `outputColorSpace = SRGB`,
  `toneMapping = NoToneMapping` (el ACES vive en el composite del post) o
  `ACESFilmicToneMapping` si el post cae.
- Post propio (`SGPost`, sin examples/jsm): scene→RT half-float → bright pass →
  blur separable ×iters (bloom selectivo) → composite (ACES + lift/gain/sat +
  viñeta + CA/distorsión SOLO-FTL + pulso + **refracción térmica local uHeat**) → sRGB.
- DPR por tier: ultra 2.25 · high 2.0 · perf 1.5 · mobile 1.4 · safe 1.5.
- Presets reales por tier (sombras 2048/1536/0, partículas, bloom iters, earthTex,
  densidad estelar, nubes, aniso). AUTO degrada DPR→nubes→bloom→post con histéresis 3 s.

## 2. SCENE GRAPH
- Grupos por capítulo: `gIntro / gSurface / gSpace / gWarp / gHub`.
- FACILITY (procedural): terreno 9 km fbm con valle + niebla aérea, pad + apron +
  flame trench + deflector + deluge manifold, cohete SG-L1 (~51 m, hull canvas-tex,
  frost band, fairings, 5 toberas, decals, detalle HIGH/ULTRA), torre 60 m
  (plataformas, brazos umbilicales, cable trays, beacons), fuel farm, water towers,
  mástil meteo, road, crew, truck en órbita circular, ciudad nocturna, SG-01.
- SPACE: **EarthRoot real**: esfera R=1400 en (0,−1620,−180) con shader día/noche/
  spec/glint + cloud shell (R+11) + atmósfera BackSide (R+44) + airglow (R+74).
  miniRocket 2 etapas + fairings reales, ship SG, 2 satélites SG.
- WARP: 3 poblaciones de line-streaks + core glow + FTL rims.
- HUB: 3 galaxias point-cloud **casi en fila** en (−330,46,−560)/(10,−14,−700)/
  (330,−34,−560), estilos por parámetros pero **misma morfología espiral base**,
  starfields esféricos, motes, dust sprites, beacon, eventos raros, selection ring.

## 3. CÁMARAS
- DIRECTOR facility: 4 segmentos orbitales lentos. ORBIT facility: orbe libre con
  clamp de terreno. FREE facility: WASD+QE, radio ≤300, altura ≤190. OK.
- ASCENT rigs: PADHERO/ENGINE/TOWERSIDE/TELE → TRACK/CHASE/NEARBODY/STRATO con
  framing Earth-aware (`_pitchForLimb`).
- ORBIT director: hero limb 55 % + departure por posición real (0,−40,0)→(0,660,1500).
- ORBIT camMode 'orbit': **orbita la NAVE, no la Tierra** (hallazgo §31-32 spec).
- **HALLAZGO P0 (§189): FREE en espacio clampeada a caja x±70, y −90..30, z±40**
  (`_freeGoal`, rama `!onSurface`) → no hay exploración espacial real.
- No existía `frameSphere`/coverage QA numérico en pantalla.

## 4. AUDIO
- 100 % procedural WebAudio: wind/rain/engine/crackle/reso/water/mach/sub/pad +
  blips, ignitionBoom, thunder, warpRiser, mechClack, warpThump, radioBlip.
- **HALLAZGO P0 (§190): countdown = beeps (`countdownTick`), NO hay voz** ni
  clips locales ni SpeechSynthesis. Mission Control no habla.
- SOUND OFF silencia el master (gain 0). Correcto.

## 5. COUNTDOWN VISUAL
- `ui.setCount('T-05' … 'T-01' / 'IGNITION')` en `#count-big` (clamp 34-64 px).
  Existe visual, pero no los dígitos grandes 5-4-3-2-1 del spec §53.
  Nota CSS: `#count-big` usa `var(--mono)` que NO está definida (bug tipográfico).

## 6. ASSETS FÍSICOS (inspección de carpetas)
- `assets/earth/` **NO EXISTE**. `assets/moon.jpg` NO existe. `assets/models/` solo README.
- `vendor/` solo README → **sin Three local**.
- `celestial.loadOptionalTextures()` ya busca `assets/earth/day.jpg`,
  `night.jpg`, `clouds.png`, `assets/moon.jpg` y los usa automáticamente
  (prioridad sobre procedural). El pipeline existe; **los archivos no**.
  → En HIGH/ULTRA la Tierra era 100 % procedural (QA §128/§188: FAIL).
- Fallback procedural (canvas geográfico + worker) sano; se conserva.

## 7. BUGS CONCRETOS ENCONTRADOS (con causa raíz)
1. **Mach 1 deforma el cohete (spec §67/§191)**: `SGPost.compU.uHeat` (warp de
   pantalla local del plume) solo se actualiza dentro de `_surfaceUpdate()`, que
   deja de ejecutarse cuando `gSurface.visible=false` tras el cloud-break. El
   valor y el centro (`uHeatC`, `uHeatT`) quedan CONGELADOS → una región fija de
   la pantalla sigue refractando en `ascentSpace` y dobla el fuselaje del
   miniRocket. FIX V3.4: reset de uHeat al salir de superficie + damping global.
2. **Telemetría obsoleta en Hub (adicional §6)**: `_enterHub()` no actualiza el
   panel; si se llega vía SALTAR VIAJE, queda `SG-L1 // ASCENT · ALT 0.13 KM`.
3. **Rectángulo oscuro Star Mark (adicional §4)**: `nebulaTex()` reparte blobs
   por TODO el canvas 256² sin fade radial → el sprite `neb` (2.2R×1.4R aditivo)
   revela sus bordes como un rectángulo alrededor de la galaxia 03. También
   afecta a los `hubDust` sprites.
4. **Mach 1 demasiado blanco (§85-87)**: cielo `0x8fb8dd` + flash cloud-punch
   0.68 + exposición: el evento queda lavado; el cohete casi desaparece.
5. **Hub = fila de menú (adicional §3)**: centros casi coplanares, misma
   morfología espiral, mismo tamaño relativo (0.72/1.0/0.82 sobre igual base).
6. `#count-big`/`#quick`/`#obj-tag` usan variables CSS inexistentes
   (`--mono`, `--cy`).
7. Texturas opcionales de Tierra se cargan sin `?v=` (cache busting §177).

## 8. LO QUE YA ESTABA BIEN (se preserva)
- Arquitectura de capítulos con reloj monotónico + watchdog + autotest completo.
- Failsafes: LITE, SAFE 3D, degrade ladder, context-loss restore, build coherence.
- Astronomía real (sol/luna/planetas/GMST/cielo rígido), clima Open-Meteo con
  cache y fallback, guardado local, discoveries, scanner, Photo Mode, ES/EN,
  gamepad, reduced-motion, LITE con los 3 destinos reales.
- Los 3 destinos URLs verificados en `config.js` — NO SE TOCAN.
- Separación de etapas / fairings ya son geometría real de dos etapas.

## 9. PLAN V3.4 (derivado de esta auditoría)
P0: vendor Three local · assets Tierra/Luna reales (NASA-derived, locales) ·
shader/upgrade path con cache-busting · frameSphere + coverage QA · Earth-orbit
camera real · FREE espacial sin caja (safe-sphere) · FOCUS/RESET/LOCATE HOME ·
countdown 5-4-3-2-1 con voz ES/EN (SpeechSynthesis local, fallback beep) ·
fix uHeat · Mach 1 legible · hub telemetry · hub redesign (3 morfologías,
X/Y/Z, nebulosas con fade, parallax, black hole, llegada cinemática, nave).
