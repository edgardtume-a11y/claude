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
