# ASSET-CREDITS — UNIVERSO SEBAS GRANDA
VERSION 1.3.0 · BUILD 20260820-V33-01

Regla aplicada (V3 §4/§5/§65): solo assets propios, CC0 o de dominio público;
todo lo que se afirma incluido está físicamente dentro del ZIP; nada se
hotlinkea; las fuentes externas preparadas-pero-no-incluidas se declaran como
tales, nunca como implementadas.

## 1) INCLUIDO EN ESTA ENTREGA (100 % del contenido visible)

| Asset | Fuente | Licencia | Modificación |
|---|---|---|---|
| Cohete SG-L1 (hero procedural + pase de detalle HIGH/ULTRA) | Generado por código en `js/experience.js` para este proyecto | Obra propia del proyecto SG | — |
| Torre de servicio, pad irregular, drenaje, escaleras, fuel farm, ops cabin, vehículos, crew, SG-01 (dron guía) | Generado por código (`js/experience.js`) | Obra propia | — |
| Nave interestelar SG (hero procedural + detalle) | Generado por código; diseño original SG (V3 §24: no copia de la referencia) | Obra propia | — |
| Terreno del Valle de Aburrá, ciudad nocturna, clima, nubes | Procedural (`js/experience.js`), geografía guiada por coordenadas reales de Medellín | Obra propia | — |
| Tierra (día/noche/nubes/especular) y Luna (maria) | Canvases geográficos generados en `js/celestial.js` (costas y luces trazadas por código a partir de conocimiento geográfico general; ninguna imagen externa embebida) | Obra propia | — |
| Cielo estelar, Vía Láctea, planetas, catálogos | Posiciones calculadas en `js/astronomy.js` (algoritmos astronómicos estándar de dominio público — Meeus) | Obra propia / fórmulas de dominio público | — |
| Galaxias del Hub, warp, partículas, humo v3 | Shaders y geometría propios (`js/experience.js`) | Obra propia | — |
| Texturas canvas (hull, hazard, señalética, decals SG, seams/bump) | Generadas en runtime por código propio | Obra propia | — |
| Audio (motores, radio, UI, ambiente) | Síntesis WebAudio en `js/audio.js` | Obra propia | — |
| Tipografía del HUD | Fuentes del sistema (stack `monospace` / sans del navegador) | Fuentes del sistema del usuario | — |
| three.js r161 (cuando esté en `vendor/three.module.js`) | https://threejs.org | MIT | Sin modificar |

## 2) SLOTS PREPARADOS — VACÍOS EN ESTE ZIP (declaración honesta §5)

El entorno de construcción de esta entrega no tiene acceso a red, por lo que
NO fue posible descargar legalmente binarios externos. En consecuencia:

- `assets/models/*/*.glb` — vacíos. El pipeline (`js/sgassets.js`) los detecta
  y usa si los colocas; hoy la entrega usa los héroes procedurales (§2).
- `assets/earth/day.jpg · night.jpg · clouds.png` y `assets/moon.jpg` —
  vacíos. Fuente recomendada: NASA Visible Earth / Blue Marble (día),
  Black Marble (noche), SVS CGI Moon Kit (Luna). Dominio público según las
  NASA Media Usage Guidelines; sin logos/insignias NASA como identidad SG y
  sin sugerir afiliación (V3 §4). Instrucciones exactas: `assets/README.txt`.
- `assets/textures/*` y `assets/hdri/` — vacíos. Fuente recomendada:
  Poly Haven (CC0) para PBR/HDRI; el entorno indirecto actual se genera por
  PMREM de escenas propias, y el cielo visible sigue siendo el astronómico
  real (V3 §14: ningún HDRI sustituye al cielo).
- `vendor/three.module.js` y `vendor/three-addons/*` — ver `DEPLOY.md` §1
  (comando de un solo paso; el loader valida y usa CDN pinneado 0.161.0 como
  respaldo mientras tanto).

Ninguna parte de la experiencia depende de estos archivos para funcionar ni
para pasar el autotest: son mejoras de fidelidad que se activan solas.

## 3) LO QUE NO SE USÓ

Sin imágenes de referencia incrustadas, sin capturas como fondos, sin video,
sin assets de SpaceX/NASA/Virgin/otras marcas, sin hotlinks (V3 §48/§56-§58).

## 4) NOTA V3.2

Esta fase no añade ningún asset externo: intro multilingüe, capas de motor,
heat haze, gradiente de cielo, encuadres de curvatura/órbita y beats de HUD
son código y shaders propios. Las técnicas de referencia estudiadas están
documentadas en THIRD-PARTY.md. Los slots de §2 siguen igual de honestos:
vacíos y auto-detectados.

## 5) NOTA V3.3 — Earth Asset Pass (declaración honesta)

La directiva V3.3 pedía descargar Blue Marble / Black Marble / Blue Marble
Clouds y guardarlos en `assets/earth/` SI existía acceso a Internet durante
el desarrollo. Se intentó: las peticiones a `visibleearth.nasa.gov` y
`eoimages.gsfc.nasa.gov` fueron bloqueadas por el proxy del entorno de build
(HTTP 403, `x-deny-reason: host_not_allowed`). Por tanto:

- `assets/earth/day.jpg`, `night.jpg`, `clouds.png` NO están en este ZIP.
- El overlay `?debug=1` muestra `EARTH DAY/NIGHT/CLOUDS = LOD0|HI` (canvas
  geográfico propio con costas y ciudades reales) — nunca dirá `FILE` hasta
  que los archivos existan, y por eso NO se declara «Earth Asset Pass».
- El contrato del loader (`js/celestial.js → loadOptionalTextures`) busca
  exactamente esos tres nombres; basta copiar los archivos NASA (dominio
  público) siguiendo `assets/README.txt` y el upgrade es automático,
  sin tocar código. Resolución objetivo 4096×2048 (HIGH/ULTRA) o
  2048×1024 (PERF); generar versiones optimizadas si el source es mayor.

## 6) V3.4 — TRUE EARTH: IMAGINERÍA NASA REAL INCLUIDA EN EL ZIP

Fecha de obtención: 2026-08-20. Los hosts oficiales NASA
(`visibleearth.nasa.gov`, `eoimages.gsfc.nasa.gov`) siguen bloqueados por el
proxy de egress de este entorno (HTTP 403 CONNECT, documentado en
AUDIT-V34.md §5). La imaginería NASA se obtuvo por el ÚNICO canal permitido:
el paquete npm `three-globe@2.45.2` (MIT, © Vasco Asturiano,
https://github.com/vasturiano/three-globe), que redistribuye reproducciones
de las imágenes NASA en `example/img/` y `example/clouds/`. Las imágenes NASA
son de dominio público según las NASA Media Usage Guidelines
(https://www.nasa.gov/nasa-brand-center/images-and-media/); no se usa logo,
insignia ni se sugiere afiliación o respaldo de NASA.

### Originales sin modificar — `assets/earth/source/`

| Archivo | Obra NASA de origen | URL de origen (oficial) | Resolución | Tamaño | SHA-256 (16) |
|---|---|---|---|---|---|
| `earth-blue-marble.jpg` | NASA Visible Earth — Blue Marble: Land Surface, Ocean Color and Sea Ice (Reto Stöckli, NASA GSFC) | https://visibleearth.nasa.gov/collection/1484/blue-marble | 4096×2048 | 1.43 MB | 228deba2e4b60014 |
| `earth-night.jpg` | NASA Earth Observatory — Earth at Night / Black Marble (NASA GSFC / NOAA) | https://earthobservatory.nasa.gov/features/NightLights | 4096×2048 | 0.70 MB | 355ab23dd1323315 |
| `clouds.png` | NASA Visible Earth — Blue Marble Clouds (canal alfa real) | https://visibleearth.nasa.gov/images/57747/blue-marble-clouds | 4096×2048 | 4.92 MB | 35c46d8b29651a99 |
| `earth-water.png` | Máscara oceánica derivada de Blue Marble (three-globe) | ídem colección Blue Marble | 1600×800 | 0.42 MB | 3a8132db56aac4e6 |
| `earth-topology.png` | Topología/elevación derivada (three-globe) — no usada en runtime V3.4 | ídem | 2048×1024 | 0.37 MB | 839b12da2e4dd346 |

Vía de redistribución: `https://registry.npmjs.org/three-globe/-/three-globe-2.45.2.tgz`
(`package/example/img/*`, `package/example/clouds/clouds.png`).

### Derivados runtime — `assets/earth/runtime/` (generados con Pillow 12.3, Lanczos)

| Archivo | Derivación | Resolución | Uso |
|---|---|---|---|
| `day-4096.jpg` | Blue Marble recomprimido q88 | 4096×2048 | HIGH/ULTRA día |
| `day-2048.jpg` / `day-1024.jpg` | reescalado Lanczos | 2048×1024 / 1024×512 | PERF / MOBILE |
| `night-4096.jpg` | Black Marble recomprimido q85 | 4096×2048 | HIGH/ULTRA luces urbanas |
| `night-2048.jpg` / `night-1024.jpg` | reescalado | 2048×1024 / 1024×512 | PERF / MOBILE |
| `clouds-alpha-2048.png` / `-1024.png` | RGBA blanco + CANAL ALFA REAL del original (no luminancia; el original P-con-transparencia se preservó intacto en source/) | 2048×1024 / 1024×512 | shell de nubes |
| `spec-1024.jpg` | máscara oceánica en escala de grises (blanco=agua) | 1024×512 | especular/glint solo océanos |

El loader (`js/celestial.js → loadOptionalTextures`) elige resolución por tier
y cae al procedural SOLO si el archivo falta. `?qa=v34` verifica en vivo
`DAY/NIGHT/CLOUDS/SPEC = FILE` y marca ERROR un HIGH/ULTRA sin archivo real.

Mejora opcional para el usuario final (sin tocar código): descargar los
originales 8K/full-res directamente de las URLs NASA de arriba y regenerar
los derivados con las mismas rutas.

### Otros añadidos V3.4

| Asset | Fuente | Licencia |
|---|---|---|
| `vendor/three.module.js` (three 0.161.0 build oficial, 1.28 MB) | `https://registry.npmjs.org/three/-/three-0.161.0.tgz` (package/build/three.module.js) | MIT |
| Voz del countdown | `SpeechSynthesis` del navegador del visitante (es-CO→es-419→es-US→es-MX→es-ES / en-US); sin servicios TTS externos, ningún dato del visitante sale del navegador. Slots para clips locales: `assets/audio/voice/` + `manifest.json` (vacíos, documentados) | API del navegador |
| Marcador HOME//MEDELLÍN, aurora polar, cono de condensación Mach 1 | Código y shaders propios (`js/experience.js`) | Obra propia |
