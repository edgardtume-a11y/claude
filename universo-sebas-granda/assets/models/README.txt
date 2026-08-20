UNIVERSO SEBAS GRANDA — HERO MODEL SLOTS (V3 §3)
=================================================

QUÉ HAY HOY EN ESTA CARPETA
  Nada más que este archivo. Los héroes que ves en pantalla (cohete SG-L1,
  torre, nave interestelar SG, instalación) son PROCEDURALES: se generan por
  código en js/experience.js con su pase de detalle HIGH/ULTRA. Ese es el
  contrato de fallback de V3 §2 y sigue siendo la versión oficial de la
  entrega. Esta carpeta NO afirma contener modelos que no están (V3 §5).

CÓMO FUNCIONA EL SLOT (js/sgassets.js)
  Al llegar a cada capítulo, el pipeline hace HEAD a:

    assets/models/rocket/rocket.glb      (Facility)
    assets/models/tower/tower.glb        (Facility)
    assets/models/ship/ship.glb          (Ascent → Orbit)
    assets/models/ground/ground.glb      (reservado)
    assets/models/vehicles/vehicles.glb  (reservado)
    assets/models/props/props.glb        (reservado)

  Si el archivo existe, se carga LOCALMENTE (nunca hotlinking) y sustituye la
  malla procedural conservando las referencias funcionales (brillo de tobera,
  banda de escarcha, carenados). Si no existe o falla: silencio y procedural.

FORMATOS SOPORTADOS
  · GLB (glTF 2.0 binario, buffers embebidos) — parser propio incluido:
    POSITION/NORMAL/UV/índices + factores PBR (baseColor/metallic/roughness/
    emissive). Sin dependencias externas.
  · GLB con Draco / KTX2 / Meshopt — soportado automáticamente si colocas los
    addons oficiales de three r161 en:
        vendor/three-addons/GLTFLoader.js
        vendor/three-addons/DRACOLoader.js  + vendor/three-addons/draco/
        vendor/three-addons/KTX2Loader.js   + vendor/three-addons/basis/
        vendor/three-addons/meshopt_decoder.module.js
    El pipeline los detecta y los prefiere (V3 §3: DRACO/KTX2/Meshopt
    "preparado").

ESCALA Y ORIGEN ESPERADOS
  rocket : origen en la base del vehículo, +Y arriba, altura ≈ 51 m
  tower  : origen en el suelo, +Y arriba, altura ≈ 56 m
  ship   : origen en el centro, −Z proa, longitud ≈ 12 m

LICENCIAS
  Solo assets propios, CC0 o con licencia explícitamente compatible
  (V3 §4). Documenta cada archivo que añadas en ASSET-CREDITS.md.
