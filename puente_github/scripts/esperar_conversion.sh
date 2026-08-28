#!/usr/bin/env bash
# Espera hasta 230 s a que termine la conversion y reporta. Se queda por
# debajo del tiempo maximo de una orden del puente a proposito.
set +e
PID=/home/trading/conversion_viejos.pid
DIR=/home/trading/restore_stage_20260825/ubuntu
for i in $(seq 1 46); do
  if [ ! -f "$PID" ] || ! kill -0 "$(cat "$PID")" 2>/dev/null; then break; fi
  sleep 5
done
bash "$(dirname "$0")/ver_conversion.sh"
echo
echo "=== manifiesto ==="
M="$DIR/parquet_manifiesto.json"
if [ -f "$M" ]; then
  /home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python - "$M" <<'PY'
import json,sys,collections
d=json.load(open(sys.argv[1]))
segs = d.get("segmentos") or d.get("segments") or d
if isinstance(segs, dict): segs = list(segs.values())
c = collections.Counter((s.get("estado") or s.get("status")) for s in segs if isinstance(s,dict))
print("  segmentos:", len(segs), "| estados:", dict(c))
PY
else
  echo "  todavia no hay manifiesto en $M"
fi
echo "ESPERA_OK"
