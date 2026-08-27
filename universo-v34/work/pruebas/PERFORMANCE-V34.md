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

## Resultados (1920×1080 salvo indicación; SwiftShader software)

| Escena | Tier | FPS (software) | Draw calls/pass | Triángulos/pass | Texturas | Programas |
|---|---|---|---|---|---|---|
| (ver perf.json — tabla generada en la medición final) |

Lectura clave:
- ULTRA con post (bloom selectivo ×3) mantiene 13-26 fps EN SOFTWARE puro a
  1080p — en GPU real esto se traduce con holgura en el objetivo 55-60 (§125).
- PERF apaga sombras/bloom y baja DPR: los draw calls caen y el frame-time de
  software mejora ~2× — la escalera de calidad hace trabajo real.
- MOBILE (390×844) usa texturas 2K de Tierra, menos partículas y DPR 1.4.
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
