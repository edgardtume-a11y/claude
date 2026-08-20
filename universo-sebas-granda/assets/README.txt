UNIVERSO SEBAS GRANDA — ASSETS (V3.4: TRUE EARTH INCLUIDA)
====================================================================================

★ V3.4: la Tierra REAL ya viene incluida en assets/earth/ ★

  assets/earth/source/    → originales NASA sin modificar (Blue Marble día,
                            Black Marble noche, Blue Marble Clouds con alfa,
                            máscara oceánica). Ver ASSET-CREDITS.md §6.
  assets/earth/runtime/   → derivados optimizados que el código carga por tier:
                            day-4096/2048/1024.jpg · night-4096/2048/1024.jpg ·
                            clouds-alpha-2048/1024.png · spec-1024.jpg
                            (4096 HIGH/ULTRA · 2048 PERF · 1024 MOBILE)

NO BORRES assets/earth/runtime/: sin esos archivos la Tierra vuelve al
fallback procedural y ?qa=v34 lo marcará como ERROR en HIGH/ULTRA.

El resto de esta carpeta sigue siendo OPCIONAL (el sitio funciona completo):

ARCHIVOS OPCIONALES ADICIONALES QUE EL CÓDIGO BUSCA:

  assets/earth/day.jpg      → override legacy de día (prioridad menor que runtime/)
  assets/earth/night.jpg    → override legacy de noche
  assets/earth/clouds.png   → override legacy de nubes (con alfa)
  assets/moon.jpg           → NASA LRO / CGI Moon Kit (superficie lunar, equirectangular)
  assets/audio/voice/       → clips de voz del countdown (ver su README.txt)

DÓNDE DESCARGARLAS (todas dominio público, cortesía NASA):

  Blue Marble (día):      https://visibleearth.nasa.gov/collection/1484/blue-marble
  Black Marble (noche):   https://earthobservatory.nasa.gov/features/NightLights
  Nubes:                  https://visibleearth.nasa.gov/images/57747/blue-marble-clouds
  Luna (CGI Moon Kit):    https://svs.gsfc.nasa.gov/4720

RECOMENDACIONES:
  · Resolución 2048×1024 o 4096×2048 (equirectangular 2:1).
  · JPG con calidad 80–90 para day/night; PNG con alfa para clouds.
  · Copia los archivos, sube la carpeta assets/ junto al resto del sitio y listo.
  · Si algún archivo falta o falla, el sistema vuelve en silencio a la versión
    procedimental — nunca verás una Tierra negra.

ATRIBUCIÓN SUGERIDA (opcional, buena práctica):
  "Earth and Moon imagery courtesy of NASA (Visible Earth / Scientific
   Visualization Studio). Public domain."

IMPORTANTE: este proyecto nunca hace hotlinking a servidores de la NASA en
producción; las imágenes se sirven desde tu propio hosting.
