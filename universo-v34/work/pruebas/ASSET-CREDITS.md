# ASSET-CREDITS — UNIVERSO SEBAS GRANDA
VERSION 1.4.0 · BUILD 20260827-V34-01

Regla aplicada (V3 §4/§5/§65 · V3.4 §14/§15): solo assets propios, CC0,
dominio público o con licencia explícita compatible; todo lo que se afirma
incluido está físicamente dentro del ZIP; nada se hotlinkea en runtime; cada
recurso externo declara fuente, licencia, fecha, resolución y transformación.

## 1) TRUE EARTH — IMÁGENES REALES INCLUIDAS EN V3.4 (`assets/earth/`, `assets/moon.jpg`)

Nota de procedencia (V3.4 §159, declaración honesta): el entorno de
construcción de esta entrega tiene una política de egreso que BLOQUEA los
hosts de NASA (`visibleearth.nasa.gov`, `earthobservatory.nasa.gov`,
`svs.gsfc.nasa.gov` — CONNECT 403 verificado y registrado). En lugar de usar
una textura aleatoria (prohibido) o fingir la descarga (prohibido), se usó la
alternativa legítima prevista por el propio prompt: derivados oficiales de la
imaginería NASA de dominio público, redistribuidos dentro de los repositorios
MIT de las MISMAS librerías que este proyecto estudia como referencia
(`vasturiano/three-globe` y `mrdoob/three.js`). La imaginería NASA subyacente
es dominio público (NASA Media Usage Guidelines); los repositorios que la
redistribuyen son MIT. No se usa ningún logo, worm ni insignia NASA y nada
sugiere afiliación de NASA con SG.

| Archivo runtime | Contenido | Fuente exacta (descarga 2026-08-27) | Imaginería subyacente | Licencia | Original | Runtime | Transformación |
|---|---|---|---|---|---|---|---|
| `assets/earth/day.jpg` | Superficie diurna | `raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg` | NASA Visible Earth — Blue Marble | Imagen: dominio público NASA · repo: MIT | 4096×2048 | 4096×2048 JPG q85 | Recompresión baseline |
| `assets/earth/day_2k.jpg` | Ídem (PERF/MOBILE/SAFE) | ídem | ídem | ídem | 4096×2048 | 2048×1024 JPG q85 | Lanczos + recompresión |
| `assets/earth/night.jpg` | Luces nocturnas | `raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-night.jpg` | NASA Earth Observatory — Black Marble / Earth at Night | ídem | 4096×2048 | 4096×2048 JPG q85 | Recompresión baseline |
| `assets/earth/night_2k.jpg` | Ídem (PERF/MOBILE/SAFE) | ídem | ídem | ídem | 4096×2048 | 2048×1024 JPG q85 | Lanczos + recompresión |
| `assets/earth/clouds.png` | Densidad de nubes | `raw.githubusercontent.com/mrdoob/three.js/r161/examples/textures/planets/earth_clouds_2048.png` | NASA Visible Earth — Blue Marble Clouds | Imagen: dominio público NASA · repo three.js: MIT | 2048×1024 RGBA | 2048×1024 PNG gris | Canal alfa extraído como luminancia (documentado; el shader lee `.r`); PNG sin pérdida para evitar bloques de compresión sobre el glint |
| `assets/earth/clouds_1k.png` | Ídem (PERF/MOBILE) | ídem | ídem | ídem | 2048×1024 | 1024×512 PNG gris | Lanczos |
| `assets/moon.jpg` | Superficie lunar | `raw.githubusercontent.com/mrdoob/three.js/r161/examples/textures/planets/moon_1024.jpg` | Imaginería lunar NASA/USGS | ídem | 1024×512 | 1024×512 JPG q88 | Recompresión |
| `vendor/three.module.js` | three.js r161 build oficial | `npm pack three@0.161.0` → `package/build/three.module.js` (registry.npmjs.org) | — | MIT | 1.3 MB | 1.3 MB | Sin modificar |

- La máscara oceánica/especular se DERIVA en runtime del propio `day.jpg`
  (`celestial.deriveOceanMask`) para que el glint coincida con la imaginería
  real; no hay archivo adicional.
- Los originales descargados se conservan sin tocar en el paquete PRODUCTION
  (`source-assets/`), fuera del ZIP de hosting.
- Atribución sugerida en producto: "Earth and Moon imagery courtesy of NASA
  (Visible Earth / Earth Observatory). Public domain."

## 2) OBRA PROPIA (100 % del resto del contenido visible)

| Asset | Fuente | Licencia |
|---|---|---|
| Cohete SG-L1, torre, pad, fuel farm, mástiles, vehículos, crew, SG-01, nave SG | Generado por código (`js/experience.js`) | Obra propia SG |
| Terreno del Valle de Aburrá + crestas lejanas V3.4, ciudad nocturna, clima | Procedural, geografía guiada por coordenadas reales de Medellín | Obra propia |
| Tierra procedural de RESPALDO (canvases geográficos) y Luna procedural | `js/celestial.js` — se mantienen como fallback si faltan los archivos | Obra propia |
| Cielo estelar, Vía Láctea, planetas (posiciones reales) | `js/astronomy.js`, algoritmos Meeus (dominio público) | Obra propia |
| Galaxy Hub V3.4 (3 morfologías, nebulosas, agujero negro, fondo) | Shaders y geometría propios | Obra propia |
| Texturas canvas (hull 1024, hazard, decals, seams) | Runtime, código propio | Obra propia |
| Audio (motores, radio, UI, ambiente) + voz de misión | Síntesis WebAudio propia + SpeechSynthesis LOCAL del navegador (sin TTS externo, sin API keys) | Obra propia / API del navegador |
| Tipografía del HUD | Stack de fuentes del sistema | Fuentes del usuario |

## 3) SLOTS PREPARADOS — SIGUEN VACÍOS (declaración honesta)

- `assets/models/*/*.glb` — héroes GLB opcionales; el pipeline
  (`js/sgassets.js`) los usa si los colocas. La entrega usa los héroes
  procedurales.
- `assets/textures/*`, `assets/hdri/` — vacíos; el entorno indirecto se
  genera por PMREM de escenas propias.
- Deep Star Map NASA SVS: evaluado (V3.4 §49); no incluido en esta entrega —
  el cielo estelar por catálogo + Vía Láctea procedural cumple el objetivo
  visual sin 4K adicionales. Documentado como mejora futura.

## 4) NASA MEDIA GUIDELINES (V3.4 §14)

Revisadas. Esta entrega: no usa el logo/worm/insignia de NASA; no afirma ni
sugiere respaldo de NASA a SG; usa únicamente imágenes de datos de dominio
público con crédito. Cumple.
