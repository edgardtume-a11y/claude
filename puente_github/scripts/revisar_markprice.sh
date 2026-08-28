#!/usr/bin/env bash
# REVISION del cambio para capturar precio de marca y tipo de financiacion.
# Mismo orden que la de liquidaciones: primero lo irreversible (la base, el
# esquema), despues lo corregible.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
BASE=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
N=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"
echo "staging: $N"

echo
echo "=== 1) LO IRREVERSIBLE: ¿se toco la instalacion base? (todo debe ser 0) ==="
for f in collector.py parquet_store.py models.py normalize.py config.py protocol.py audit.py dual_main.py; do
  echo -n "  base/$f: "; grep -c -iE 'mark_price|markPrice|MARK_PRICE' "$BASE/$f" 2>/dev/null
done
echo "  fechas de la base (deben ser anteriores al 28/08 12:24):"
for f in collector.py parquet_store.py models.py normalize.py config.py protocol.py; do
  echo -n "    $f "; stat -c '%y' "$BASE/$f" | cut -c1-16
done

echo
echo "=== 2) LO IRREVERSIBLE: ¿cambio el esquema? ==="
"$PY" -c "
import sys; sys.path.insert(0,'$N/overlay/src')
from binance_collector.models import CSV_FIELDS, SCHEMA_VERSION
print('  ', len(CSV_FIELDS), 'columnas | version', SCHEMA_VERSION)
print('   DEBE SER: 36 columnas | version 2.0.0')
" 2>&1 | tail -3

echo
echo "=== 3) las listas cerradas del overlay ==="
grep -n -A12 '_SEQUENCED_RECORD_TYPES\s*=' "$S/parquet_store.py" | head -14

echo
echo "=== 4) ¿se rompio algo que no se debia tocar? ==="
chk() { if grep -q "$2" "$S/$3" 2>/dev/null; then echo "  $1: INTACTO"; else echo "  $1: ***PERDIDO***"; fi; }
chk "contrato de parada"    '_validate_stop_request' dual_main.py
chk "salida con codigo 20"  'exit_code = 20'         dual_main.py
chk "uvloop"                'loop_factory'           dual_main.py
chk "gc.freeze"             'gc.freeze()'            dual_main.py
chk "force_order_batch"     'force_order_batch'      normalize.py
chk "nada de gc.disable"    'gc.disable'             dual_main.py
echo "  (el ultimo DEBE decir PERDIDO)"

echo
echo "=== 5) ¿MARK_PRICE entra en la cadena causal del libro? (NO debe) ==="
grep -n -A12 '_CAUSAL_RECORD_TYPES' "$S/audit.py" | head -16

echo
echo "=== 6) ¿compila todo lo tocado? ==="
for f in collector.py parquet_store.py models.py normalize.py config.py protocol.py audit.py dual_main.py; do
  if "$PY" -m py_compile "$S/$f" 2>/dev/null; then echo "  $f: compila"; else echo "  $f: ***NO COMPILA***"; "$PY" -m py_compile "$S/$f" 2>&1 | tail -3; fi
done

echo
echo "=== 7) diff contra el staging de liquidaciones: cuanto cambio de verdad ==="
V=/home/trading/jean-flow-exec/staging_runs/20260828T083219Z_forceorder/overlay/src/binance_collector
for f in collector.py parquet_store.py models.py normalize.py config.py protocol.py audit.py dual_main.py; do
  echo -n "  $f: "; diff -u "$V/$f" "$S/$f" 2>/dev/null | grep -c '^[+-]' | tr -d '\n'; echo " lineas cambiadas"
done
echo "REV_MP_OK"
