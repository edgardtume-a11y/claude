#!/usr/bin/env bash
# ¿Que valida los tipos de registro? De esto depende si anadir liquidaciones
# cuesta horas o cuesta cambiar el esquema (y entonces repetir todo lo captado).
#
# La apuesta: si record_type es una columna libre y nadie valida contra una lista
# cerrada, se puede anadir FORCE_ORDER como un tipo mas, sin tocar las 36
# columnas ni la version 2.0.0 del esquema. Si hay listas cerradas, hay que
# ampliarlas en cada sitio o la conversion a Parquet fallara en silencio.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) listas cerradas de tipos en parquet_store ==="
grep -n -A12 '_SEQUENCED_RECORD_TYPES\s*=' "$SRC/parquet_store.py" | head -20
grep -n -A10 '_UNSEQUENCED_RECORD_TYPES\s*=' "$SRC/parquet_store.py" | head -14

echo
echo "=== B) que pasa con un tipo que no este en ninguna lista ==="
grep -n -B3 -A12 '_SEQUENCED_RECORD_TYPES' "$SRC/parquet_store.py" | grep -n -A12 'def _validate_row' | head -20
sed -n "/def _validate_row/,/^def /p" "$SRC/parquet_store.py" | head -45

echo
echo "=== C) ¿el auditor valida record_type contra una lista? ==="
grep -n 'record_type' "$SRC/audit.py" | head -15

echo
echo "=== D) ¿models.py tiene una lista cerrada de tipos? ==="
grep -n -i 'RECORD_TYPE\|_TYPES\s*=' "$SRC/models.py" | head -12

echo
echo "=== E) donde se abren los flujos de websocket ==="
grep -n 'aggTrade\|@depth\|streams\|combined' "$SRC/collector.py" | head -12
echo "VALIDACION_OK"
