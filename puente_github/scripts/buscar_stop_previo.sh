#!/usr/bin/env bash
# Solo lectura: busca STOP.json de gates anteriores para conocer el formato exacto.
BASE=/home/trading/jean-flow-exec/staging_runs
echo "=== STOP.json ANTERIORES ==="
for f in $(ls -t $BASE/*/control/STOP.json 2>/dev/null | head -3); do
  echo "--- $f"
  cat "$f"
  echo
done
echo "=== session.json DEL GATE ACTUAL ==="
cat $BASE/20260827T143004Z_tokyo_n2_capture_gate3_2h/control/session.json 2>/dev/null
echo
echo "=== VALIDACION DEL STOP EN EL MOTOR ==="
grep -rnE 'stop_file|requested_by_pid|capture_session_id|requested_utc_ns' \
  /home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector/*.py 2>/dev/null | head -15
echo BUSCAR_OK
