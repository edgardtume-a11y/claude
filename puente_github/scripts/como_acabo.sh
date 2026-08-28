#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
echo "=== ¿queda algo corriendo? ==="
pgrep -fc 'binance_collector[.]dual_main' | sed 's/^/  capturas: /'
echo
echo "=== como termino ==="
ls -l "$N/control/" 2>/dev/null
echo "  --- session.json: estado final ---"
python3 - <<PY
import json
try:
    d=json.load(open("$N/control/session.json"))
    for k in ("error","exit_code","live","stopped_utc_ns","health"):
        v=d.get(k)
        if k=="health" and isinstance(v,dict):
            print("  health.live:", v.get("live"), "| identity_ready:", v.get("identity_ready"))
        elif k!="health": print(" ",k,"=",v)
except Exception as e: print("  no se pudo leer:",e)
PY
echo "  --- STOP.json / READY.json ---"
head -c 300 "$N/control/STOP.json" 2>/dev/null; echo
echo
echo "=== que capturo ==="
du -sh "$N/capture" 2>/dev/null
for m in spot usdm_futures; do
  echo -n "  $m: "; find "$N/capture/$m" -name '*.csv' 2>/dev/null | wc -l | tr -d '\n'; echo -n " cerrados, "
  find "$N/capture/$m" -name '*.csv.partial' 2>/dev/null | wc -l | tr -d '\n'; echo " sin cerrar"
done
echo "  duracion: 15:54 -> $(stat -c '%y' "$N/control/HEARTBEAT.json" 2>/dev/null | cut -c12-19)"
echo
echo "=== ¿se audito? ==="
ls -l "$N/audit/" 2>/dev/null | head -12
cat "$N/audit/return_codes.json" 2>/dev/null
echo
echo "=== disco ==="; df -h /home | tail -1
echo "CA_OK"
