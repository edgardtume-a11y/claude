#!/usr/bin/env bash
# El gate 4 certifico 4/4 CON uvloop y gc.freeze. Este gate falla en 7 umbrales,
# todos de latencia. La hipotesis obvia: corrio SIN esas mejoras.
set +e
P=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/overlay/src/binance_collector
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet/overlay/src/binance_collector

echo "=== ¿lleva las mejoras cada overlay? ==="
printf "%-14s %-10s %-10s %-10s\n" "" "postmask" "gate4" "auditparquet"
for k in uvloop loop_factory 'gc.freeze()' 'import gc'; do
  a=$(grep -c "$k" "$P/dual_main.py" 2>/dev/null); b=$(grep -c "$k" "$G4/dual_main.py" 2>/dev/null); c=$(grep -c "$k" "$AP/dual_main.py" 2>/dev/null)
  printf "  %-12s %-10s %-10s %-10s\n" "$k" "$a" "$b" "$c"
done

echo
echo "=== ¿son el mismo dual_main? ==="
for f in dual_main.py writer.py collector.py; do
  echo -n "  $f postmask vs gate4: "; diff -q "$P/$f" "$G4/$f" >/dev/null 2>&1 && echo "IDENTICO" || { diff -u "$G4/$f" "$P/$f" 2>/dev/null | grep -c '^[+-]' | tr -d '\n'; echo " lineas de diferencia"; }
done

echo
echo "=== huellas ==="
for d in "$P" "$G4" "$AP"; do echo "  $(sha256sum "$d/dual_main.py" | cut -c1-16)  $d"; done

echo
echo "=== ¿que dice el log del arranque sobre el bucle de eventos? ==="
M=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/capture/jean_flow_metrics.jsonl
grep -o 'event_loop=[a-z]*' "$M" 2>/dev/null | head -3
grep -o 'gc_frozen=[0-9]*' "$M" 2>/dev/null | head -3
echo "  (si no sale nada: no se registro, señal de que no lleva el parche)"

echo
echo "=== comparacion con el gate 4 certificado ==="
python3 - <<PY
import json
g4=json.load(open("/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/audit/metrics.json"))
pm=json.load(open("/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/audit/metrics.json"))
print("  metrica                 mercado        gate4(cert)   postmask(fall)")
for m in ("spot","usdm_futures"):
    for n in ("book_apply_p99","book_pipeline_p99","event_loop_lag_p99","writer_yield_p99","parse_p99"):
        a=((g4.get("markets") or {}).get(m,{}).get("thresholds",{}) or {}).get(n,{})
        b=((pm.get("markets") or {}).get(m,{}).get("thresholds",{}) or {}).get(n,{})
        print(f"  {n:24s}{m:14s} {str(a.get('worst_value_ms')):12s}  {str(b.get('worst_value_ms'))}")
    print()
print("  ventanas evaluadas: gate4", (g4.get("markets") or {}).get("spot",{}).get("windows"), "| postmask", (pm.get("markets") or {}).get("spot",{}).get("windows"))
PY
echo "TM_OK"
