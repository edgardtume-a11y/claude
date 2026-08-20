UNIVERSO SEBAS GRANDA — ASSETS OPCIONALES (mejora automática de la Tierra y la Luna)
====================================================================================

El sitio funciona COMPLETO sin esta carpeta: la Tierra y la Luna se generan
proceduralmente con geografía real (costas, ciudades reales de noche, mares
lunares reales). Si quieres el nivel máximo de fidelidad fotográfica, puedes
añadir imágenes reales de la NASA (dominio público). El código las detecta
solo — sin tocar nada más — y las usa automáticamente.

ARCHIVOS QUE EL CÓDIGO BUSCA (nombres exactos):

  assets/earth/day.jpg      → NASA Blue Marble (color de la superficie, equirectangular)
  assets/earth/night.jpg    → NASA Black Marble / Earth at Night (luces de ciudad)
  assets/earth/clouds.png   → capa de nubes con transparencia (equirectangular)
  assets/moon.jpg           → NASA LRO / CGI Moon Kit (superficie lunar, equirectangular)

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
