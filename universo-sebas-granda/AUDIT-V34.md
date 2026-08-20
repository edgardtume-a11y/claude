# AUDIT V3.4 — UNIVERSO SEBAS GRANDA
### Auditoría técnica de V3.3 (build 20260820-V33-01) ANTES de modificar código
Fecha: 2026-08-20 · Auditor: Claude Code (Lead WebGL/Three.js pass)

> Este documento describe QUÉ EXISTE y QUÉ FALLA. No declara ningún PASS.

---

## 1. INVENTARIO REAL DEL ZIP

| Área | Estado encontrado |
|---|---|
| Three.js | **r161 (0.161.0)**. `vendor/three.module.js` NO está en el ZIP (solo README). El loader valida vendor primero y cae a CDN jsDelivr/unpkg pinneado. En producción sin vendor → depende 100% del CDN. |
| Cámara principal | Una sola `PerspectiveCamera(58, aspect, near=0.1, far=30000)` (`experience.js:731`). |
| Earth | SÍ existe una esfera 3D real: `_bEarthCore()` (`experience.js:2300`). `earthCenter=(0,-1620,-180)`, `earthR=1400`, `SphereGeometry(1400,84,56)` + shells de nubes (R+11), atmósfera (R+44, BackSide), airglow (R+74). Vive en `gSpace`. |
| Earth shaders | Day/night con `dot(N,sunDir)` + smoothstep, especular oceánico por máscara, night lights solo lado nocturno, banda cálida de terminador, atmósfera Fresnel Rayleigh/Mie-flavoured. La ESTRUCTURA es correcta. |
| Earth textures | **NO HAY NINGÚN ARCHIVO DE TEXTURA EN EL ZIP.** `assets/` solo contiene README.txt. `assets/earth/day.jpg / night.jpg / clouds.png` que busca `CEL.loadOptionalTextures()` no existen → SIEMPRE se usa el fallback procedural (canvas ≤1024 vía worker, LOD0 256 sliced). |
| Cloud layer | Shell independiente con drift propio, `transparent`, `depthWrite:false` ✓. Alpha viene del canvas procedural. |
| Sun direction | Real (`ASTRO.sunDirEarthFixed`) o "hero staging" (`_orientEarthHero`: Medellín rotado a (0,0.92,0.39), sol fijo (0.46,0.60,0.66)). |
| Cámara ascent | Rigs con `_pitchForLimb` (limb-aware, sin pitch mágico): TRACK .10 · CHASE .16 · NEARBODY .22 · STRATO .34. |
| Cámara orbit (director) | Limb al 55% (`frac 0.55`) con FOV 58. Matemáticamente ≈55% de pantalla debajo del limb. |
| Cámara FREE | `_freeGoal`: en órbita está **encerrada en una caja arbitraria** `x∈[-70,70], y∈[-90,30], z∈[-40,40]` (`experience.js:5329-5331`). No conoce la esfera. Sin FOCUS EARTH. Al entrar hereda la orientación actual → puede quedar mirando a la nada. |
| Stage separation | `_stageSep` + booster que cae/rota/culls (3.4 s) — existe y es razonable. |
| Fairing | Dos mitades con impulso lateral opuesto, rotación, culling 2.6 s — existe. |
| Post-processing | `SGPost` propio: bloom threshold selectivo + grading + viñeta + CA/distorsión FTL-only + **heat haze local enmascarado por disco de pantalla** (`uHeat/uHeatC/uHeatR`). |
| Countdown | 5→1 con `setCount('T-0n')` + BEEPS (`audio.countdownTick`). **No hay voz. No hay número grande.** |
| Audio | 100% procedural WebAudio (wind/rain/engine/water/pad/blips). Sin SpeechSynthesis. Desbloqueo por gesto ya implementado (`unlockOnce`, main.js:40). |

## 2. FALLO 1 — POR QUÉ NO SE VE LA TIERRA

Cuatro causas combinadas, verificadas en código:

1. **Texturas inexistentes.** HIGH/ULTRA renderiza el fallback procedural (≤1024 y océanos con albedo 0.012–0.19). Tras `alb*(0.03+1.28·d)` + ACES + viñeta 0.32, el océano queda ≈ RGB(3,24,51): en pantalla junto a estrellas brillantes **lee como negro**. La única parte que sobrevive es el rim atmosférico → exactamente "una línea/arco" como en las capturas.
2. **Departure nunca encuadra el disco.** El path de cámara `pos=(0,-40+dep*700, dep*1500)` termina a d≈2832 del centro, donde el diámetro angular (59°) sigue siendo MAYOR que `fov*0.82` (42.6°) → la rama "full disc" de `_camGoal` **es inalcanzable**; el final del departure y toda la fase CHARGE (pantalla ACTIVAR WARP) se queda en limb-framing de una esfera casi negra → captura 1: fondo negro + "LIGHT SPEED READY".
3. **FREE CAMERA en caja ±70** no puede alejarse ni orbitar el planeta (R=1400): la Tierra solo puede verse "de canto" desde dentro de la caja, y al entrar la cámara conserva un rumbo cualquiera.
4. **Sin QA de cobertura**: nada mide cuánta pantalla ocupa la Tierra, así que las regresiones de encuadre no se detectan.

## 3. FALLO 2 — DEFORMACIÓN DEL COHETE EN MACH 1 (captura 4)

**Causa raíz encontrada:** el heat haze `uHeat` SOLO se actualiza/amortigua dentro de `_surfaceUpdate()` (`experience.js:5027-5044`), que deja de ejecutarse cuando `gSurface.visible=false` (whiteout → `ascentSpace`). El valor de `uHeat`, el centro `uHeatC` y el radio `uHeatR` **quedan congelados** con lo último visto en superficie; el disco de refracción huérfano queda cerca del centro de pantalla, exactamente donde el mini-cohete pasa en Mach 1 → el warp de pantalla dobla el fuselaje (captura: cuerpo en S).
Además la máscara actual es un disco isotrópico centrado en la tobera: incluso en superficie alcanza PARTE DEL FUSELAJE por encima de la tobera.

**Fix planeado:** (a) resetear `uHeat=0` al entrar a espacio y amortiguarlo fuera de `_surfaceUpdate`; (b) máscara anisotrópica restringida al AIRE POR DEBAJO de la tobera.

## 4. OTROS HALLAZGOS

- `ENTREGA-V3.3.txt` afirma soporte NASA "opcional", pero **ningún archivo existe** → el debug muestra `EARTH DAY=LOD0/HI` y jamás `FILE`. No se puede declarar TRUE EARTH.
- `_earthTexSrc` ya distingue `stub/lod0/hi/file` — buena base para el criterio QA (§36 del brief).
- La tecla `F` ya está tomada por el scanner (`experience.js:3192`) → FOCUS EARTH usará `F` solo en FREE cam orbital (el scanner no se usa ahí) y QA button.
- `?debug=1` tiene panel QA V3.3 con 6 botones; no hay `?qa=v34`, ni saltos a countdown/mach1/max-q, ni coverage.
- `boot-diagnostics.DIAG_ASSETS` no verifica ninguna textura de Tierra.
- Countdown timeline (T-5 luces, T-4 presurización, T-3 vapor+arm2, T-2 arm1, T-1 deluge+hero cam, T-0 ignición, +1 s liftoff) ya coincide en espíritu con el brief §16; faltan voz, números grandes y "DESPEGUE" retardado tras "IGNICIÓN".
- Primeros metros de liftoff: `lerpTable [[0,0],[0.6,0.5],[1.4,3.2],[2.4,14]…]` — ya lentos/pesados ✓.
- Orbit HERO: `ui.cinematic(true)` + `hideActionButtons([])` ya ocultan HUD ✓; dura 2.3 s (el brief pide 2.5–4).
- Fairings/booster ya se cull-ean → no quedan "pedazos blancos" (verificar en QA).
- Galaxy Hub: lógica click/dblclick/touch V3.3 intacta — NO tocar, solo regresión.

## 5. ASSETS — SITUACIÓN DE RED EN ESTE ENTORNO

- Egress policy: `visibleearth.nasa.gov`, `eoimages.gsfc.nasa.gov`, `cdn.jsdelivr.net` → **403 CONNECT (bloqueados)**. Documentado (brief §45).
- `registry.npmjs.org` SÍ permitido → se obtuvieron:
  - `three@0.161.0` oficial → `vendor/three.module.js` (1.28 MB) — misma versión r161, sin migración.
  - `three-globe@2.45.2` (MIT, Vasco Asturiano) que redistribuye **imágenes NASA reales**: `earth-blue-marble.jpg` **4096×2048** (NASA Blue Marble), `earth-night.jpg` **4096×2048** (NASA Black Marble/Earth at Night), `earth-water.png` 1600×800 (máscara oceánica), `clouds.png` 4096×2048 **con canal alfa real** (Blue Marble Clouds).
- Estos archivos son imagería NASA (dominio público, sin logo NASA) vía mirror MIT; las URLs NASA de origen quedan documentadas en `ASSET-CREDITS.md` para que el usuario pueda sustituir por descargas directas de visibleearth.nasa.gov si lo desea.

## 6. PLAN DE CORRECCIÓN V3.4 (resumen)

1. Texturas reales tier-aware (`assets/earth/runtime/`: day 4096/2048/1024 · night 4096/2048/1024 · clouds-alpha 2048/1024 · spec 1024) + loader con fallback procedural intacto.
2. `EarthRoot` agrupado + marcador HOME//MEDELLÍN + aurora sutil HIGH/ULTRA + rotación viva.
3. `frameSphere`/`earthScreenCoverage` matemáticos; HERO ≥45%; departure 60→45→32→disco completo con distancia real (nada de scale).
4. FREE CAMERA esférica limitada por `earthR` (min R+70, max 3.4R), FOCUS EARTH (F), RESET ORBIT VIEW (R), velocidad por altitud.
5. Countdown 5-4-3-2-1 con voz (SpeechSynthesis es-CO→es-ES / en-US; clips locales si existen; beep+texto como último fallback) + números grandes.
6. Fix uHeat (Mach 1) + evento Mach 1 (cono condensación/shock collar) + Max-Q diferenciado.
7. `?qa=v34` con saltos reales (mismo código de producción, reloj real) + botones + coverage en vivo + verificación FILE/PROCEDURAL.
8. Playwright + Chromium local (SwiftShader si hace falta) → 15 capturas obligatorias.
