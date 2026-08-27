# PERFORMANCE V3.4 — UNIVERSO SEBAS GRANDA
VERSION 1.4.0 · BUILD 20260827-V34-01

## Cómo leer estas cifras (medido, no estimado — §125/§152)
El único runtime WebGL disponible en el entorno de build es Chromium headless
con **SwiftShader** (rasterizador por SOFTWARE sobre 4 vCPU). Sus FPS son un
piso extremo, no el rendimiento real: una GPU integrada modesta rinde
típicamente 10-30× este número en escenas Three.js de este tamaño. Lo que SÍ
es representativo del build (independiente de GPU) son: draw calls,
triángulos, texturas, programas y memoria — y las DIFERENCIAS entre tiers.
Los valores exactos por escena están en `qa-evidence/perf.json` (medidos con
`renderer.info` acumulado durante 2 s con autoReset desactivado).

## Resultados (1920×1080 salvo indicación; SwiftShader software; calidad
fijada ANTES del boot vía localStorage para que la geometría se construya
ya en el tier correcto — nunca un cambio de calidad a mitad de escena)

| Escena | Tier | FPS (software) | Draw calls/frame | Triángulos/frame | Texturas | Programas | Sombras | Bloom | DPR |
|---|---|---|---|---|---|---|---|---|---|
| Facility hero | ULTRA | 32.0 | 310 | 117 336 | 28 | 30 | ON | ON | 1.0 |
| Earth orbit hero | ULTRA | 20.4 | 39 | 24 440 | 32 | 34 | ON | ON | 1.0 |
| Galaxy Hub | ULTRA | 22.9 | 77 | 4 356 | 29 | 37 | ON | ON | 1.0 |
| Facility hero | PERF | 30.4 | 270 | 55 350 | 23 | 28 | OFF | OFF | 1.0 |
| Earth orbit hero | PERF | 22.8 | 34 | 24 430 | 27 | 32 | OFF | OFF | 1.0 |
| Galaxy Hub | PERF | 20.8 | 59 | 4 321 | 24 | 35 | OFF | OFF | 1.0 |
| Earth orbit hero | MOBILE 390×844 | 23.9 | 28 | 24 418 | 27 | 32 | OFF | OFF | 0.85 |
| Galaxy Hub | MOBILE 390×844 | 20.3 | 52 | 4 168 | 24 | 35 | OFF | OFF | 0.85 |

Metodología: `renderer.info` acumulado con `autoReset=false`, dividido por
frames visuales REALES contados vía `requestAnimationFrame` (no por
`info.render.frame`, que cuenta cada sub-pase interno del post — bloom
activo invoca `renderer.render()` ~9 veces por frame visual vs 2 sin bloom;
dividir por esa cifra habría deflactado el promedio de ULTRA de forma
engañosa — detectado y corregido durante esta misma medición). Datos
crudos: `qa-evidence/perf.json`.

Lectura clave:
- ULTRA en SOFTWARE puro (SwiftShader, sin GPU) sostiene 20-32 fps en la
  facility y 20-23 fps en Earth Hero / Hub a 1080p con sombras y bloom
  activos — en GPU real (órdenes de magnitud más rápida en rasterización)
  esto tiene margen amplio para el objetivo 55-60 fps (§125).
- La escalera de calidad hace trabajo REAL y medible: PERF reduce
  triángulos de facility en ~53 % (117k→55k) apagando el detalle hero
  (`_detailHero()`) y usando menos segmentos de terreno; sombras y bloom se
  apagan (confirmado `shadows:false, bloom:false`).
- La esfera de la Tierra pesa lo mismo en triángulos en todos los tiers
  (24.4k) porque solo cambia la RESOLUCIÓN de textura (4K→2K), no la
  geometría — coherente con el diseño (§126).
- MOBILE detectado correctamente (`tier:"mobile"`, DPR 0.85, sombras OFF)
  una vez el harness de prueba simula `hasTouch`/`isMobile` — confirma que
  la detección de dispositivo en `_tier()` funciona como está escrita.
- AUTO degrada DPR → nubes → bloom → post con histéresis de 3 s y se
  recupera al mejorar (sin oscilación) — sin cambios en V3.4.

## Memoria GPU de texturas de Tierra (§126 — calculada, RGBA8 + mipmaps ×1.33)
- day 4096×2048 ≈ 42.7 MB · night 4096×2048 ≈ 42.7 MB ·
  clouds 2048×1024 ≈ 10.7 MB · máscara oceánica 1024×512 ≈ 2.7 MB ·
  moon 1024×512 ≈ 2.7 MB → **≈ 101 MB** en ULTRA/HIGH (razonable para
  desktop; los ~5.5 MB comprimidos en red NO son la memoria real).
- PERF/MOBILE (2K/1K): ≈ 10.7 + 10.7 + 2.7 + 0.7 + 2.7 → **≈ 27.5 MB**.
- Mitigaciones activas: resolución por tier, carga perezosa por-mapa,
  fallback procedural 256 hasta que decodifican, worker HI omitido cuando
  hay archivos (§130).

## Peso de red del sitio (hosting)
- Total ZIP hosting ≈ 6 MB: three.js local 1.3 MB + Tierra 4K/2K ≈ 3.9 MB +
  código ≈ 0.6 MB. Carga progresiva: la experiencia arranca con procedural
  y la Tierra real entra por detrás (§127); cache larga + ?v=BUILD (§177).

## Optimización aplicada en V3.4
- uHeat post-uniform ya no se evalúa fuera de superficie (decay y early-out).
- Worker de Tierra procedural HI omitido con archivos reales (§130).
- near-plane dinámico: elimina artefactos y trabajo de precisión en far view.
- Nebulosas/galaxias del hub: counts por tier (ULTRA 6400·gal → MOBILE 2400).
- Foreground/bg-galaxies del hub también escalan por tier.
