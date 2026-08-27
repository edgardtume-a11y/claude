#!/usr/bin/env bash
# Solo lectura: extrae del motor el formato exacto que espera STOP.json
SRC=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h/overlay/src/binance_collector
echo "=== LECTURA DEL STOP EN EL MOTOR ==="
grep -rnB3 -A25 'def .*stop_file\|stop_file.*exists\|_read_stop\|load_stop' "$SRC"/*.py 2>/dev/null | head -60
echo "=== CAMPOS REQUERIDOS ==="
grep -rnE 'requested_by_pid|requested_utc_ns|"reason"|STOP_REQUIRED|stop_payload' "$SRC"/*.py 2>/dev/null | head -20
echo FORMATO_OK
