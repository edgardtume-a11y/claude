#!/usr/bin/env bash
# REVISION del cambio para capturar liquidaciones forzadas.
#
# Es el cambio mas consecuente hecho al motor: toca el camino de los datos de
# una captura de 7 dias. Se revisa entero antes de dejarlo acercarse a nada.
#
# El orden de las comprobaciones no es casual: primero lo que seria irreversible
# (que no se haya tocado la instalacion base, que no haya cambiado el esquema),
# y solo despues lo que se puede corregir.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
BASE=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
RUNS=/home/trading/jean-flow-exec/staging_runs
NUEVO=$(ls -dt "$RUNS"/*forceorder* 2>/dev/null | head -1)

if [ -z "$NUEVO" ]; then
  echo "TODAVIA NO HAY STAGING forceorder"
  ls -dt "$RUNS"/* 2>/dev/null | head -3
  exit 0
fi
SRC="$NUEVO/overlay/src/binance_collector"
echo "staging: $NUEVO"

echo
echo "=== 1) LO IRREVERSIBLE: ¿se toco la instalacion base? ==="
for f in collector.py parquet_store.py audit.py models.py dual_main.py; do
  h=$(sha256sum "$BASE/$f" 2>/dev/null | cut -c1-16)
  echo "  base/$f: $h"
done
echo "  (deben coincidir con los de antes del cambio; la base NO se toca)"

echo
echo "=== 2) LO IRREVERSIBLE: ¿cambio el esquema? ==="
echo -n "  SCHEMA_VERSION: "; grep -oE 'SCHEMA_VERSION = "[^"]+"' "$SRC/models.py" | head -1
echo -n "  columnas CSV_FIELDS: "
"$PY" -c "
import sys; sys.path.insert(0,'$NUEVO/overlay/src')
from binance_collector.models import CSV_FIELDS, SCHEMA_VERSION
print(len(CSV_FIELDS), 'columnas | version', SCHEMA_VERSION)
print('  DEBE SER: 36 columnas | version 2.0.0')
" 2>&1 | tail -3

echo
echo "=== 3) ¿esta FORCE_ORDER en la lista cerrada de parquet_store? ==="
grep -n -A10 '_SEQUENCED_RECORD_TYPES\s*=' "$SRC/parquet_store.py" | head -12
echo "  --> FORCE_ORDER debe aparecer ahi. Si no, la conversion a Parquet"
echo "      fallara en todo fichero con una liquidacion, EN VIVO."

echo
echo "=== 4) ¿se suscribe al flujo de liquidaciones? ==="
grep -n 'forceOrder\|force_order\|FORCE_ORDER' "$SRC/collector.py" | head -12

echo
echo "=== 5) ¿se rompio algo que no se debia tocar? ==="
chk() { if grep -q "$2" "$SRC/$3" 2>/dev/null; then echo "  $1: INTACTO"; else echo "  $1: ***PERDIDO***"; fi; }
chk "contrato de parada"      '_validate_stop_request' dual_main.py
chk "salida con codigo 20"    'exit_code = 20'         dual_main.py
chk "uvloop"                  'loop_factory'           dual_main.py
chk "gc.freeze"               'gc.freeze()'            dual_main.py
chk "nada de gc.disable"      'gc.disable'             dual_main.py
echo "  (el ultimo debe decir PERDIDO: gc.disable no debe existir)"

echo
echo "=== 6) ¿compila todo lo tocado? ==="
for f in collector.py parquet_store.py models.py dual_main.py audit.py; do
  "$PY" -m py_compile "$SRC/$f" 2>&1 | head -2 && echo "  $f: compila" || echo "  $f: NO COMPILA"
done

echo
echo "=== 7) las pruebas ==="
cd "$NUEVO" && PYTHONPATH=overlay/src "$PY" -m pytest overlay/tests -q 2>&1 | tail -15

echo "REVISAR_FORCEORDER_OK"
