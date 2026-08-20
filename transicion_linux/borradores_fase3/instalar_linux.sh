#!/usr/bin/env bash
# BORRADOR FASE 3, NO ACTIVADO — Instalador de JEAN_FLOW 555 para Linux.
#
# Equivalente funcional de INSTALAR_EN_C_v241.cmd con la misma disciplina:
#   1. Verifica el sello del paquete ANTES de tocar nada (paquete adulterado
#      = instalación abortada, cero cambios en disco).
#   2. Aparta la instalación previa intacta como 555_anterior_<marca>
#      (evidencia histórica: JAMÁS se borra ni se pisa).
#   3. Extrae el paquete sellado y verifica los 144 sellos del manifiesto.
#   4. Construye el entorno OFFLINE desde el wheelhouse Linux con
#      --require-hashes (idéntica versión exacta del requirements.lock).
#   5. Corre la batería de pruebas completa antes de declarar instalado.
#
# Uso:  ./instalar_linux.sh JEAN_FLOW_555_META_QUANT_vX.Y.Z.zip SELLO_SHA256
#       (el sello esperado del zip se pasa explícito, como hace SELLOS.sha256)

set -euo pipefail

# Cero privilegios, fallo cerrado (equivalente del rechazo CONSOLA_ELEVADA
# del instalador de Windows): la instalación es de usuario, jamás de root.
if [ "$(id -u)" -eq 0 ]; then
  echo "CONSOLA_ELEVADA: no ejecutes el instalador como root ni con sudo."
  echo "Nada fue modificado."
  exit 3
fi

PAQUETE="${1:?Falta el zip sellado}"
SELLO_ESPERADO="${2:?Falta el SHA-256 esperado del zip}"
# Equivalente Linux de C:\JF (instalación de usuario, sin privilegios):
DESTINO="${JF_DESTINO:-$HOME/JF}"
MARCA="$(date -u +%Y%m%dT%H%M%SZ)"

echo "== Paso 1: verificar el sello del paquete (antes de tocar nada) =="
SELLO_REAL="$(sha256sum "$PAQUETE" | cut -d' ' -f1)"
if [ "$SELLO_REAL" != "$SELLO_ESPERADO" ]; then
  echo "PAQUETE ADULTERADO: sello real $SELLO_REAL != esperado $SELLO_ESPERADO"
  echo "No se modificó nada."
  exit 1
fi
echo "Sello del paquete: OK"

echo "== Paso 2: apartar la instalación previa (si existe), sin tocarla =="
if [ -d "$DESTINO/555" ]; then
  mv "$DESTINO/555" "$DESTINO/555_anterior_${MARCA}"
  echo "Instalación previa apartada en: $DESTINO/555_anterior_${MARCA}"
fi
mkdir -p "$DESTINO"

echo "== Paso 3: extraer y verificar los sellos del árbol =="
unzip -q "$PAQUETE" -d "$DESTINO"
( cd "$DESTINO" && sha256sum --quiet -c 555/RELEASE_MANIFEST.sha256 ) || {
  echo "MANIFIESTO ROTO tras extraer: instalación inválida."
  exit 1
}
TOTAL=$(wc -l < "$DESTINO/555/RELEASE_MANIFEST.sha256")
echo "Sellos del árbol: ${TOTAL}/${TOTAL} OK"

echo "== Paso 4: entorno Python 3.12 offline desde el wheelhouse Linux =="
PY=python3.12
"$PY" -c 'import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)' || {
  echo "BOOTSTRAP_FAILED: se necesita Python 3.12."
  exit 2
}
WHEELHOUSE="$DESTINO/555/binance_phase1_collector/wheelhouse_linux"
LOCK="$WHEELHOUSE/requirements_linux.lock"
[ -f "$LOCK" ] || { echo "Falta el wheelhouse Linux sellado."; exit 1; }
"$PY" -m venv "$DESTINO/555/venv"
"$DESTINO/555/venv/bin/pip" install --quiet --no-index \
  --find-links "$WHEELHOUSE" --require-hashes -r "$LOCK"
echo "Entorno instalado offline con verificación de sellos."

echo "== Paso 5: batería de pruebas antes de declarar instalado =="
( cd "$DESTINO/555/binance_phase1_collector" \
  && PYTHONPATH=src "$DESTINO/555/venv/bin/python" -m pytest tests/ -q )

echo "== Instalación COMPLETA en $DESTINO/555 =="
echo "Punto de entrada único: $DESTINO/555/iniciar.sh"
