# THIRD-PARTY — UNIVERSO SEBAS GRANDA
VERSION 1.3.0 · BUILD 20260820-V33-01

Regla V3.2 §2 aplicada: `study technique → adapt minimum necessary →
preserve architecture → test`. En esta entrega NO se vendorizó código de
terceros, NO se añadieron dependencias y NO se actualizó Three.js. Todo lo
listado abajo son TÉCNICAS estudiadas cuya implementación en este proyecto
es propia y está escrita a medida del stack actual (three r161 vía loader).

## Software incluido / cargable

| Componente | Licencia | Estado en el ZIP |
|---|---|---|
| three.js r161 (`vendor/three.module.js` + fallback CDN pinneado 0.161.0) | MIT | Slot documentado en DEPLOY.md §1; no redistribuido dentro del ZIP por el entorno sin red |
| Addons oficiales three r161 (GLTFLoader/DRACO/KTX2/Meshopt) | MIT | Slots opcionales `vendor/three-addons/` detectados por `js/sgassets.js`; no incluidos |

## Técnicas estudiadas (referencia intelectual, implementación propia)

- `bobbyroe/threejs-earth` (MIT) — arquitectura de Tierra por capas: day map,
  night lights solo en lado nocturno, cloud shell independiente de radio
  mayor, atmósfera Fresnel aditiva BackSide. Nuestro shader en
  `js/experience.js` (_bEarthCore) implementa esa filosofía con mezclado
  día/crepúsculo/noche por `dot(N,Sun)`, glint oceánico propio y banda de
  terminador cálida. Ningún archivo de ese repo está en este proyecto.
- `vasturiano/three-globe` (MIT) — lógica de Day/Night Cycle y Solar
  Terminator (interpolación de texturas según dirección solar) y ejemplos de
  clouds/satélites. Usada solo como referencia de comportamiento.
- `artcodev/three-fluid-fx` — concepto de refracción/UV-distortion. En lugar
  de integrar la dependencia, el heat haze de V3.2 §21 es un pase propio de
  ~20 líneas dentro del composite existente (`SGPost`): ruido value 2D
  animado, enmascarado radialmente a la posición de pantalla del motor,
  con intensidad por tier (ULTRA/HIGH) y apagado en PERF/SAFE (§22).
- `takram-design-engineering/three-geospatial` — filosofía de scattering /
  perspectiva aérea estudiada; NO se integraron sus paquetes (WebGPU /
  three superior). La solución compatible con r161 es nuestra atmósfera
  Rayleigh/Mie-flavoured + airglow ya presente, ajustada en esta fase.
- three.js docs oficiales — UnrealBloomPass/EffectComposer como referencia
  de bloom selectivo por threshold; nuestro `SGPost` propio ya implementa
  bright-pass con umbral + knee y se mantiene (§23/§24).
- Algoritmos astronómicos (Meeus, dominio público) — ya usados por
  `js/astronomy.js` desde P0.

## Fuentes de datos/imagen recomendadas (no incluidas, ver ASSET-CREDITS §2)

NASA Blue Marble / Black Marble / SVS CGI Moon Kit (dominio público,
NASA Media Usage Guidelines) y Poly Haven (CC0). Slots locales preparados;
nunca hotlinking en producción (§75).

## Nota V3.3

- NASA SLS (documentación pública de misión) — estudiada SOLO conceptualmente
  para la lógica MECO → stage separation → upper-stage → fairing jettison.
  SG-L1 sigue siendo un vehículo original del Universo SG: geometría,
  proporciones y estética propias; nada de SLS se copió visualmente.
- Sin dependencias nuevas en V3.3: staging, cámara Earth-aware, Earth
  Departure, doble clic robusto, anillo de selección y failsafe son código
  propio sobre el stack existente (three r161).
