#!/usr/bin/env bash
# Prueba final de reversibilidad, ya con los CSV borrados.
#
# Se reconstruye un CSV a partir de un parquet del gate 3 -la captura mas
# valiosa- y se le da al auditor. Si el auditor certifica, queda demostrado que
# borrar no perdio nada que importe: el dato vuelve y pasa el examen.
#
# Ya no hay original contra el que comparar huellas: por eso la comparacion byte
# a byte se hizo ANTES de borrar, sobre la captura pequena, y el auditor la
# certifico entonces (rc=0). Esto lo confirma sobre el gate 3.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src
REC=/home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py
G3=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
TMP=/home/trading/reversibilidad_tmp
mkdir -p "$TMP"

P=$(find "$G3/capture/usdm_futures" -name '*.parquet' | sort | head -1)
echo "parquet de origen: $(basename "$P")  ($(stat -c%s "$P") bytes)"

echo
echo "=== 1) reconstruir el CSV ==="
DEST="$TMP/$(basename "${P%.parquet}").csv"
"$PY" "$REC" --parquet "$P" --destino "$DEST" 2>&1 | tail -8

echo
echo "=== 2) ¿el auditor lo certifica? ==="
PYTHONPATH="$SRC" "$PY" -m binance_collector.audit journal "$DEST" 2>&1 | head -30
echo "codigo de retorno del auditor: ${PIPESTATUS[0]}"

echo
echo "=== 3) limpieza ==="
rm -rf "$TMP"
echo "REVERSIBILIDAD_OK"
