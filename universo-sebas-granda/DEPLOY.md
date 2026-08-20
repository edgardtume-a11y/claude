# UNIVERSO SEBAS GRANDA — DEPLOY (P0.1)
VERSION 1.4.0 · BUILD 20260820-V34-01

## 0) Estado de verificación (declaración §36)
La reparación P0.1 se verificó ejecutando la máquina de estados REAL
(`js/experience.js` sin modificar) en un arnés headless con reloj monotónico:
11 escenarios — FULL/HIGH, PERF, ULTRA, SAFE, SKIP, fail=worker, fail=post,
fail=satellites, fail=weather y dos congelones de 4 s — todos terminan en
`[SG TEST] FULL MISSION PASS` con 0 errores no esperados, y las utilidades de
clasificación de errores / ventana temporal / coherencia de build / diagnóstico
de red pasan sus tests unitarios. **Este entorno de construcción no tiene
acceso a red**, por lo que la URL de producción
`https://sebasgrandamanager.starmarkagencia.com/pruebas/` no pudo abrirse desde
aquí; tampoco pudo descargarse el binario de Three.js. Esta entrega incluye,
por tanto, el protocolo exacto de validación en el hosting real (abajo) y la
instrucción de un solo comando para colocar `vendor/three.module.js`.

## 1) Colocar Three.js r161 local (OBLIGATORIO, un comando)
Desde la carpeta del sitio (o súbelo por FTP con ese nombre exacto):

    curl -L -o vendor/three.module.js https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js

Comprobación rápida: el archivo pesa ~1.2 MB y empieza por código JS
(no por `<!DOCTYPE`). El loader valida esto en runtime: si el archivo falta o
el servidor devuelve HTML, cae automáticamente a los CDN pinneados 0.161.0 y
lo marca en `?diag=1` — la experiencia FULL no depende del CDN una vez el
archivo está en su sitio (§41).

## 2) Subir TODO el contenido del ZIP a `/pruebas/`
Incluye los nuevos: `build.json`, `.htaccess`, `js/boot-diagnostics.js`,
`js/earthworker.js`, `index.html` con importmap versionado. No mezclar con
archivos de entregas anteriores: reemplazar la carpeta completa.

## 3) Purga de caché (§21)
Tras subir: purgar LiteSpeed/Hostinger cache y Cloudflare si existe.
El sistema anti-mezcla queda activo de todos modos: `index.html` declara
`BUILD 20260820-V34-01`, todos los módulos se cargan con `?v=` de ese build,
`build.json` se lee con `no-store`, y cualquier discrepancia muestra
`VERSION MISMATCH` + `RELOAD LATEST BUILD` (1 reintento automático máximo).

## 4) Protocolo de validación en producción (§37)
Sesión limpia (ventana privada):

1. `/pruebas/?diag=1` → todos los recursos `OK`, MIME JavaScript en `.js`,
   `vendor/three.module.js` OK, tres BUILD idénticos.
2. `/pruebas/?debug=1` → overlay: `UNIVERSO SG v1.4.0 BUILD 20260820-V34-01`.
3. `/pruebas/?autotest=1` → consola termina en `[SG TEST] FULL MISSION PASS`.
4. `/pruebas/?autotest=skip` → `[SG TEST] SKIP → FACILITY PASS` … `FULL MISSION PASS`.
5. `/pruebas/?autotest=1&fail=worker` · `&fail=post` · `&fail=satellites` ·
   `&fail=weather` → cada una imprime su `… FAILURE PASS` y `FULL MISSION PASS`.
6. `/pruebas/?autotest=1&fail=webgl` → LITE (única ruta legítima a LITE).
7. `/pruebas/?safe=1&autotest=1` → `[SG TEST] SAFE MODE PASS` + misión completa.
8. Escenas de arte (V3.2 §67-§71 + V3.3): `/pruebas/?shot=intro` (saludos
   legibles, sin solaparse), `?shot=facility` (misma composición + microdetalle),
   `?shot=ignition` (core/plume/gas + heat haze, sin blob blanco), `?shot=maxq`
   (horizonte CURVO abajo, cielo oscureciéndose, SIN Tierra completa),
   `?shot=orbit` (Tierra 40-55 % vertical con continentes/océano/nubes/luces,
   nave legible) y `?shot=hub`.
9. Escenas V3.3 (staging + departure + galaxias): `?shot=stageSep` (booster
   desprendiéndose con luces, cayendo atrás), `?shot=stage2` (motor fino de
   segunda etapa encendido), `?shot=fairing` (mitades abriéndose en lateral
   opuesto), `?shot=earthDeparture25` / `?shot=earthDeparture50` (Tierra 45 %
   → 30-35 % con más disco visible) y `?shot=earthDeparture100` (disco
   prácticamente completo + nave pequeña, ANTES de mostrar ACTIVAR WARP), y
   `?shot=galaxySelected` (galaxia 01 con anillo de selección y dolly 8-12 %).
10. CAPTURAS OBLIGATORIAS (V3.3): este paquete se validó con arnés de estado
   (sin GPU); las 10 capturas WebGL del criterio final deben tomarse EN ESTE
   hosting con las URLs de los puntos 8-9 + `?shot=orbit` + `?shot=hub`, y
   las dos de galaxias también manualmente (clic / doble clic). Con
   `?debug=1` el overlay debe leer `EARTH DAY=…` para el QA de assets.
11. Matriz manual de doble clic (V3.3): en el Hub —
   G01: 1 clic → panel 01 · doble clic → abre `/inicio/` · VOLVER;
   G02: 1 clic → panel 02 · doble clic → abre `/sebas/` · VOLVER;
   G03: 1 clic → panel 03 · doble clic → abre `starmarkagencia.com`;
   además 01→clic en 02 cambia a 02; 02→clic en vacío deselecciona; ESC
   deselecciona; táctil = segundo toque sobre la MISMA galaxia entra.
   Ninguna operación puede dejar el Hub bloqueado (failsafe ~2.1 s).

## 5) Prueba manual (§38) — LITE prohibido en A/B/C (§39)
A. `/pruebas/` sin tocar nada → INTRO → APPROACH → **SG AEROSPACE LAUNCH
   FACILITY** con SCAN/CAM/FOTO/MAP + INICIAR LANZAMIENTO.
B. Recargar; pulsar **SALTAR INTRO** durante la intro → FACILITY (atómico).
C. INICIAR LANZAMIENTO → countdown → liftoff → MAX-Q → orbit → FTL → HUB →
   3 galaxias con sus URLs intactas.
D. `?fail=worker` manual → misma misión completa (Tierra en LOD bajo).
E. `?safe=1` manual → misma misión completa.

## 6) Si algo falla en producción
- `?debug=1` congela solo el subsistema roto y muestra `SG RUNTIME ERROR`
  (BUILD, CHAPTER, STACK, BUILD QUEUE, GPU, WORKER, WEATHER…) — la consola
  lleva el stack completo con archivo y línea.
- Pérdida de contexto GPU → `SG.OS // GRAPHICS CONTEXT INTERRUPTED`,
  restauración automática o botón `RESTART 3D EXPERIENCE` (nunca LITE directo).
- Jerarquía real de fallback: FULL → FULL sin el efecto roto → SAFE 3D → y
  LITE únicamente si WebGL no existe o es irrecuperable.
