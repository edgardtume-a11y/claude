#!/usr/bin/env bash
# Si borramos los CSV, ¿se pueden volver a auditar esas capturas?
# La respuesta depende de si el auditor sabe leer Parquet o solo CSV.
# Hay que saberlo ANTES de borrar 32 GB, no despues.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) ¿que extensiones busca el auditor? ==="
grep -n "glob\|\.csv\|\.parquet\|iterdir\|rglob" "$SRC/audit.py" | head -20

echo
echo "=== B) ¿existe parquet_store y que expone? ==="
grep -n "^def \|^class " "$SRC/parquet_store.py" | head -25

echo
echo "=== C) ¿alguien usa parquet_store? ==="
grep -rn "parquet_store\|import parquet" "$SRC"/*.py | grep -v "^.*parquet_store.py:" | head

echo
echo "=== D) ¿el auditor menciona parquet en algun sitio? ==="
grep -cn "parquet" "$SRC/audit.py"

echo
echo "=== E) ¿reconstruct.py lee parquet? (es quien rehace el libro) ==="
grep -n "\.csv\|\.parquet\|parquet_store" "$SRC/reconstruct.py" | head -10
echo "LEE_PARQUET_OK"
