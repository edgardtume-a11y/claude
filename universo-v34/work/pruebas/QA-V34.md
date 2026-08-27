# QA V3.4 — UNIVERSO SEBAS GRANDA
VERSION 1.4.0 · BUILD 20260827-V34-01 · 2026-08-27

Entorno QA real: Chromium headless + SwiftShader (WebGL2 real por software),
servidor HTTP local, 1920×1080 / 390×844 / otros viewports. Toda la evidencia
se generó recorriendo la RUTA REAL de la misión (`?qa=v34` automatiza
skip → CTA → eventos de capítulo con saltos del reloj real; ningún estado
falso). Carpeta de evidencia: `qa-evidence/` (paquete PRODUCTION).
Los screenshots se declaran creados porque EXISTEN y fueron revisados uno a
uno; nada se fabricó (§145).

Convención: PASS = verificado con evidencia; PASS* = verificado por ruta de
código con limitación del entorno anotada; N/A = no ejecutable aquí (se dice
por qué, sin declararlo PASS §153).

## 1. CRITERIOS DE FAIL ABSOLUTOS DEL PROMPT (§188-§193)

| Criterio | Resultado | Evidencia |
|---|---|---|
| §188 HIGH/ULTRA sin `EARTH…=PROCEDURAL` | PASS — debug imprime `DAY=FILE NIGHT=FILE CLOUDS=FILE RES=4096`; worker HI `skipped-file-assets` | report.json (estado por captura) + 14/19 |
| §189 FREE fuera de la caja | PASS — caja eliminada; vuelo real hasta earthR·6 con esfera segura earthR+60 | 18/19 (disco completo alcanzado VOLANDO) |
| §190 Voz en countdown | PASS* — SpeechSynthesis local ES/EN implementada con prioridad es-CO, gating SOUND OFF, fallback beep+visual; el entorno headless NO expone SpeechSynthesis (sin audio), así que lo audible se validó por ruta de código y debe oírse en un navegador real | js/audio.js speak/countdownSay/missionLine + 02/03 (visual) |
| §191 Mach 1 no deforma el cohete | PASS — causa raíz uHeat congelado corregida; fuselaje recto | 06_mach1.png |
| §192 Earth Hero no es franja | PASS — coverage 55 % medido en runtime (objetivo 45-65 %); causa raíz aliasing _yawPitchGoal documentada en REPORT §1 | 14_earth_orbit_hero.png |
| §193 Facility no parece prototipo | PASS — hero shot recompuesto, crestas del valle, conos de luz, mástil pararrayos, hull 1024, losas re-tonalizadas | 01_facility_hero.png |

## 2. DEFINICIÓN DE TERMINADO (§194) — punto por punto

- Facility premium / SG-L1 creíble / torre-pad con escala: PASS (01, 02, 04)
- Countdown 5-4-3-2-1 visible: PASS (02: "5" gigante · 03: "1")
- Alguien lo dice + ignición/despegue audibles: PASS* (ver §190 arriba)
- Ignición con peso (chispas, deluge, vapor, luz rebotada): PASS (04)
- Water deluge visible: PASS (03/04 — vapor masivo T-1/T-0)
- Plume evoluciona por altitud: PASS (05 suelo ancho · 06 limpio · 12 vacío fino)
- Mach 1 recto y sin lavado: PASS (06)
- MAX-Q distinto: PASS (07 — rig íntimo, cielo más oscuro, telemetría DYNAMIC PRESSURE MAX)
- La Tierra se revela durante el ascenso: PASS (06/08/09 — curvatura + nubes reales abajo)
- Stage 1 se separa / Stage 2 / fairings sin piezas fantasma: PASS (11/12/13; culling verificado en 14 — nada flotando)
- Earth assets reales HIGH/ULTRA + océanos/continentes/nubes/noche/terminador/atmósfera: PASS (14/15/19)
- Earth Hero 45-65 %: PASS (55 % medido)
- EARTH ORBIT ACHIEVED muestra EL PLANETA: PASS (14)
- Esfera 3D real en Director/Orbit/Free/Photo: PASS (14/17/18/19; Photo comparte escena — el modo foto usa la misma esfera)
- Earth Orbit orbita la Tierra: PASS (17 — órbita reposicionada, coverage 100 % en acercamiento)
- FREE vuela / no atraviesa / FOCUS / RESET / LOCATE HOME: PASS (18/19; focusEarth interpola; safe-sphere proyecta; HOME marker con label)
- Departure por distancia (60→45→32→disco) sin escalar la Tierra: PASS (20/21/22 — la cámara recorre hasta 4 700 u; Earth.scale intacto)
- Pre-Warp conserva contexto: PASS (23 — disco completo + CTA ACTIVAR WARP)
- Warp corto con distorsión FTL-only: PASS (24)
- Galaxy Hub funciona / ES-EN / SOUND OFF / reduced motion / LITE / mobile: PASS (25-35 + regression.json)
- Sin errores críticos / sin 404 esenciales / sin hotlinks: PASS — los únicos
  404 son los HEAD probes OPCIONALES de `assets/models/*.glb` (contrato de
  slots §3 documentado); el único fallo de red es la API de clima bloqueada
  por el proxy del entorno → fallback OFFLINE correcto (así diseñado §157)
- Licencias/créditos: PASS (ASSET-CREDITS.md)
- Performance medido: PASS (PERFORMANCE-V34.md — medido, no estimado)
- Screenshots reales: PASS (35 PNG en qa-evidence/)
- Hosting ZIP probado: PASS (extraído a un directorio limpio y servido por
  HTTP real; boot completo + Tierra FILE verificados sobre ese árbol)

## 3. GALAXY HUB — DEFINICIÓN DE TERMINADO (adicional §62)

- Tres galaxias visualmente diferentes / ninguna recolor: PASS (29/30/31 —
  elongada-energética vs gran espiral vs barrada dorada; distinguibles en
  silueta y hasta en escala de grises)
- Conóceme comunica velocidad: PASS (29 — corrientes, anillos, streaks, pulso)
- Sebas protagonista: PASS (30 — R 250, profundidad dominante, centro)
- Star Mark morfología propia sin rectángulo: PASS (31 — barrada con nodos;
  nebulosa con falloff radial, el rectángulo desapareció)
- Sin alineación de menú / X-Y-Z real / parallax: PASS (25/28 — alturas,
  profundidades e inclinaciones distintas; foreground/nebulosas/fondo)
- Nebulosas integradas: PASS (25/28)
- Nave presente + orientación al destino + ruta: PASS (33)
- SCAN/selección/confirmación: PASS (32 + autotest GALAXY UX en regression)
- Telemetría DEEP SPACE: PASS (25 — `SG-L1 // DEEP SPACE`)
- FREE hub explorable: PASS (28)
- Mobile hub: PASS (35)
- Black hole secreto + SCAN "ANOMALY DETECTED": PASS (34)
- URLs intactas: PASS (config.js sin cambios en SG_DESTINATIONS; LITE y
  noscript conservan los 3 enlaces)

## 4. REGRESIÓN AUTOMÁTICA (ruta real completa, `regression.json`)

- `?autotest=1` → `[SG TEST] FULL MISSION PASS` (cadena completa BOOT→…→HUB,
  GALAXIES ×3, GALAXY UX select/switch/confirm suprimido)
- `?autotest=skip` → SKIP → FACILITY PASS … FULL MISSION PASS
- `?autotest=skip&fail=worker,post,satellites,weather` → cada FAILURE PASS +
  FULL MISSION PASS (degradación aislada correcta)
- `?autotest=skip&safe=1` → SAFE MODE PASS + FULL MISSION PASS
- `?lite=1` y `?fail=webgl` → LITE alcanzado con los 3 destinos
- Viewports 1366×768 · 2560×1440 · 3440×1440 · 844×390 · 1024×768 → boot sin
  errores reales de consola
- Nota consola: los únicos mensajes filtrados como esperados son
  ERR_TUNNEL (clima bloqueado por el proxy del entorno de QA), HEAD 404 de
  GLB opcionales, y avisos `navigator.vibrate` propios del headless sin
  gesto. Cero excepciones no capturadas; cero errores de compilación de
  shaders; cero import failures.

## 5. NO VERIFICABLE EN ESTE ENTORNO (honesto, §145/§153)

- Voz AUDIBLE y mezcla de audio (headless sin dispositivo de audio ni
  SpeechSynthesis): validado por ruta de código + fallbacks. Probar en
  Chrome/Edge de escritorio: countdown debe DECIRSE en ES/EN.
- Firefox / Safari / dispositivos táctiles reales: sin binarios aquí; el
  código usa APIs estándar y el diseño responsive/touch existente se
  conservó, pero NO se declara PASS (§153).
- FPS absolutos: SwiftShader es software (13-26 fps en 1080p aquí); en GPU
  real el presupuesto es órdenes de magnitud mayor — ver PERFORMANCE-V34.md
  para la lectura correcta de estas cifras.
