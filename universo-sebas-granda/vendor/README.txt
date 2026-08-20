VENDOR — THREE.JS r161 LOCAL (OBLIGATORIO EN PRODUCCIÓN)
=========================================================

La aplicación carga PRIMERO:

    vendor/three.module.js        (three.js 0.161.0, build oficial)

y solo si no existe o no es válido usa los CDN pinneados (jsDelivr/unpkg
three@0.161.0) como respaldo secundario.

CÓMO OBTENER EL ARCHIVO (1 minuto, una sola vez):

  Opción A (descarga directa):
    https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js
    → Guardar como  vendor/three.module.js

  Opción B (npm):
    npm pack three@0.161.0
    → copiar  package/build/three.module.js  a  vendor/three.module.js

VALIDACIÓN AUTOMÁTICA:
  · El loader comprueba que el archivo sea JavaScript real (>100 KB y que no
    empiece por '<'); una página 404 en HTML jamás se importará como módulo.
  · /pruebas/?diag=1 muestra el estado exacto de vendor/three.module.js
    (status HTTP, MIME, tamaño). Debe aparecer OK ~1200kb.

VERSIÓN ÚNICA DEL PROYECTO: three.js r161 / 0.161.0. No mezclar versiones.
