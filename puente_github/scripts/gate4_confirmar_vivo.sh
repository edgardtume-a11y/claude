#!/usr/bin/env bash
# ¿Se activaron de verdad uvloop y gc.freeze en la captura que corre ahora?
set +e
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
echo "=== huella de las mejoras en el arranque ==="
grep -o 'event_loop=[^"]*' "$G4/capture/jean_flow_metrics.jsonl" 2>/dev/null | head -3
grep -o 'gc_frozen=[0-9]*' "$G4/capture/jean_flow_metrics.jsonl" 2>/dev/null | head -3
grep -o 'low_latency_runtime[^"]*' "$G4/capture/jean_flow_metrics.jsonl" 2>/dev/null | head -1
echo
echo "=== proceso vivo y consumo ==="
pgrep -af 'binance_collector[.]dual_main' | head -3
ps -o pid,etime,pcpu,pmem,rss --no-headers -p $(pgrep -f 'binance_collector[.]dual_main' | head -1) 2>/dev/null
echo
echo "=== crece la captura? ==="
du -sh "$G4/capture" 2>/dev/null
ls -la "$G4/capture"/*/ 2>/dev/null | grep -c csv
echo
echo "=== ultimas lineas del arranque ==="
tail -4 "$G4/launcher_console.log" 2>/dev/null
echo "CONFIRMAR_VIVO_OK"
