#!/usr/bin/env bash
# ¿Cuanto lleva el gate 4 y como va?
set +e
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
echo "hora UTC: $(date -u +%H:%M:%S)"
P=$(pgrep -f 'binance_collector[.]dual_main' | head -1)
if [ -n "$P" ]; then
  echo "captura VIVA pid=$P transcurrido=$(ps -o etime= -p "$P" | tr -d ' ')"
else
  echo "captura TERMINADA"
  tail -3 "$G4/launcher_console.log"
fi
du -sh "$G4/capture" 2>/dev/null
echo "--- ultimo p99 de usdm en el gate 4 (con uvloop) ---"
grep 'market=usdm_futures' "$G4/capture/jean_flow_metrics.jsonl" 2>/dev/null | tail -1 \
  | python3 -c "
import json,re,sys
ln=sys.stdin.readline()
if not ln.strip():
    print('(sin metricas de usdm aun)'); raise SystemExit
m=re.match(r'^metrics market=(\S+)\s+(\{.*\})\s*$', json.loads(ln)['message'], re.S)
lat=json.loads(m.group(2))['latency_ms']
for k in ('book_apply','book_pipeline_total','writer_cooperative_yield','event_loop_lag'):
    if k in lat:
        d=lat[k]; print(f\"  {k}: p50={d.get('p50')} p99={d.get('p99')} max={d.get('max')} n={d.get('count_total')}\")
"
echo "PROGRESO_OK"
