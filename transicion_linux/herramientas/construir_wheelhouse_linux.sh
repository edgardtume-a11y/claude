#!/usr/bin/env bash
# Herramienta de la transición — reconstruye el wheelhouse Linux de forma
# reproducible y verificada por dos fuentes. Ejecutada el 20 de agosto de 2026
# para producir transicion_linux/wheelhouse_linux/ (20 ruedas, 0 discrepancias).
#
# Disciplina:
#   - Versiones EXACTAS del requirements.lock sellado (DECISIÓN DEL PROYECTO:
#     mismas versiones, no "equivalentes").
#   - Las 13 ruedas puras se toman del wheelhouse sellado de la 2.4.1: son
#     independientes de plataforma y su sello ya está en el lock.
#   - Las 7 binarias (aiohttp, frozenlist, multidict, orjson, propcache,
#     websockets, yarl) se descargan como manylinux cp312 COMPILADAS (mismo
#     rendimiento de ruta caliente que las win_amd64; la variante pura de
#     frozenlist/websockets se rechaza expresamente).
#   - Cada rueda se verifica contra la API JSON de PyPI (segunda fuente).
#
# Uso: ./construir_wheelhouse_linux.sh <wheelhouse_sellado_241> <destino>

set -euo pipefail

ORIGEN="${1:?Falta el wheelhouse sellado de la v2.4.1}"
DESTINO="${2:?Falta el directorio destino}"
mkdir -p "$DESTINO"

echo "== Ruedas puras: copiadas del paquete sellado =="
cp "$ORIGEN"/*-py3-none-any.whl "$ORIGEN"/*-py2.py3-none-any.whl "$DESTINO"/

echo "== Ruedas binarias: manylinux cp312 compiladas, versiones del lock =="
BINARIAS=(
  "aiohttp==3.14.3" "frozenlist==1.8.0" "multidict==6.7.1" "orjson==3.11.9"
  "propcache==0.5.2" "websockets==17.0.1" "yarl==1.24.5"
)
for paquete in "${BINARIAS[@]}"; do
  for intento in 1 2 3 4; do
    python3.12 -m pip download "$paquete" --no-deps -d "$DESTINO" \
      --only-binary :all: --implementation cp --abi cp312 --python-version 3.12 \
      --platform manylinux_2_28_x86_64 --platform manylinux_2_17_x86_64 \
      --platform manylinux2014_x86_64 \
      --timeout 90 -q && break
    echo "reintento $intento: $paquete"; sleep $((2**intento))
  done
done

# Ninguna binaria puede haber caído a la variante pura:
for nombre in aiohttp frozenlist multidict orjson propcache websockets yarl; do
  ls "$DESTINO"/${nombre}-*cp312*manylinux*.whl >/dev/null || {
    echo "BLOQUEO: $nombre no quedó como manylinux compilada."; exit 1; }
  rm -f "$DESTINO"/${nombre}-*-py3-none-any.whl
done

echo "== Manifiesto y lock de Linux =="
( cd "$DESTINO" && sha256sum *.whl > WHEELHOUSE_LINUX_MANIFEST.sha256 )
python3 - "$DESTINO" <<'EOF'
import hashlib, os, sys
destino = sys.argv[1]
lineas = []
for fn in sorted(f for f in os.listdir(destino) if f.endswith(".whl")):
    nombre, version = fn.split("-")[0], fn.split("-")[1]
    with open(os.path.join(destino, fn), "rb") as fh:
        sello = hashlib.sha256(fh.read()).hexdigest()
    lineas.append(f"{nombre.replace('_','-')}=={version} --hash=sha256:{sello}")
with open(os.path.join(destino, "requirements_linux.lock"), "w") as fh:
    fh.write("\n".join(lineas) + "\n")
print(f"{len(lineas)} ruedas en el lock")
EOF

echo "== Verificación contra PyPI (segunda fuente) =="
python3 - "$DESTINO" <<'EOF'
import hashlib, json, os, ssl, sys, time, urllib.request
destino = sys.argv[1]
contexto = ssl.create_default_context()
problemas = 0
for fn in sorted(f for f in os.listdir(destino) if f.endswith(".whl")):
    nombre, version = fn.split("-")[0], fn.split("-")[1]
    with open(os.path.join(destino, fn), "rb") as fh:
        local = hashlib.sha256(fh.read()).hexdigest()
    remoto = None
    for intento in range(4):
        try:
            with urllib.request.urlopen(
                f"https://pypi.org/pypi/{nombre}/{version}/json",
                context=contexto, timeout=60,
            ) as respuesta:
                datos = json.load(respuesta)
            remoto = next(
                (u["digests"]["sha256"] for u in datos["urls"] if u["filename"] == fn),
                None,
            )
            break
        except Exception:
            time.sleep(2 ** intento)
    estado = "OK" if remoto == local else f"DISCREPANCIA(pypi={remoto})"
    if remoto != local:
        problemas += 1
    print(f"{fn}: {estado}")
raise SystemExit(1 if problemas else 0)
EOF
echo "== Wheelhouse Linux completo y verificado por dos fuentes =="
