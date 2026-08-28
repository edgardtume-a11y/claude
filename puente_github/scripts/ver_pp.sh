#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
T=/home/trading/prueba_paralelo
PID=/home/trading/prueba_paralelo.pid
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "CORRIENDO"; else echo "TERMINADO"; fi
cat "$T/salida.log" 2>/dev/null
echo
echo "=== codigos: original vs paralelo ==="
echo -n "  original: "; cat "$N/audit/return_codes.json" 2>/dev/null
echo -n "  paralelo: "; cat "$T/audit/return_codes.json" 2>/dev/null
echo
echo "=== ¿mismos informes, ignorando el campo 'files' (rutas distintas)? ==="
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python - <<'PY'
import json
N="/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/audit"
T="/home/trading/prueba_paralelo/audit"
def limpio(p):
    d=json.load(open(p))
    def q(o):
        if isinstance(o,dict): return {k:q(v) for k,v in sorted(o.items()) if k!="files"}
        if isinstance(o,list): return [q(x) for x in o]
        return o
    return q(d)
for f in ("journal_spot","journal_usdm","identity"):
    try:
        a,b=limpio(f"{N}/{f}.json"), limpio(f"{T}/{f}.json")
        print(f"  {f}: {'IDENTICO' if a==b else '*** DISTINTO ***'}")
        if a!=b:
            for k in sorted(set(a)|set(b)):
                if a.get(k)!=b.get(k): print("     difiere en:",k)
    except Exception as e: print(f"  {f}: no comparable ({e})")
PY
echo "VPP_OK"
