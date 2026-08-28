#!/usr/bin/env bash
# Lo unico que cambia entre el gate 4 (certifico 4/4) y este (falla 7 umbrales)
# son 105 lineas de collector.py. Hay que verlas.
set +e
P=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/overlay/src/binance_collector
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector

echo "=== ¿que mas difiere ademas de collector.py? ==="
for f in $(ls "$G4"/*.py | xargs -n1 basename); do
  [ -f "$P/$f" ] || { echo "  $f: SOLO en gate4"; continue; }
  diff -q "$G4/$f" "$P/$f" >/dev/null 2>&1 || { echo -n "  $f: "; diff -u "$G4/$f" "$P/$f" | grep -c '^[+-]' | tr -d '\n'; echo " lineas"; }
done
for f in $(ls "$P"/*.py | xargs -n1 basename); do [ -f "$G4/$f" ] || echo "  $f: SOLO en postmask"; done

echo
echo "=== EL DIFF de collector.py, resumido a lo que se anadio ==="
diff -u "$G4/collector.py" "$P/collector.py" | grep '^+' | grep -v '^+++' | head -60

echo
echo "=== ¿que hace en el camino caliente? ==="
diff -u "$G4/collector.py" "$P/collector.py" | grep -E '^\+' | grep -viE '^\+\s*#|^\+\s*$|"""' | grep -iE 'for |while |re\.|regex|sub\(|replace\(|json|encode|decode|hash|mask' | head -20

echo
echo "=== volumen de mensajes: ¿fue un mercado mas movido? ==="
python3 - <<PY
import json
for etiq, ruta in (("gate4   ","/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/audit/metrics.json"),
                   ("postmask","/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/audit/metrics.json")):
    d=json.load(open(ruta))
    for m in ("spot","usdm_futures"):
        c=(d.get("markets") or {}).get(m,{}).get("activity_counters",{})
        w=(d.get("markets") or {}).get(m,{}).get("windows")
        tot=c.get("agg_trade_messages",0)+c.get("depth_diff_messages",0)
        mins = (w or 1)*5/60.0
        print(f"  {etiq} {m:14s} ventanas={w:4} trades={c.get('agg_trade_messages')} depth={c.get('depth_diff_messages')} syncs={c.get('book_syncs')} snapshots={c.get('rest_snapshots')}")
PY
echo "DP2_OK"
