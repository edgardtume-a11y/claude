#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
echo -n "=== ENGINE_RC: "; cat "$N/control/ENGINE_RC.txt"
echo "=== con que umbrales se audito ==="
grep -n 'audit metrics' "$N/control/run_live_audits.sh"
echo
echo "=== POR QUE FALLO metrics ==="
python3 - <<PY
import json
d=json.load(open("$N/audit/metrics.json"))
def hojas(o, ruta=""):
    if isinstance(o, dict):
        for k,v in o.items(): yield from hojas(v, ruta+"/"+str(k))
    elif isinstance(o, list):
        for i,v in enumerate(o): yield from hojas(v, ruta+"[%d]"%i)
    else: yield ruta, o

print("  certification:", d.get("certification"))
errs = d.get("errors") or []
print("  errores:", len(errs))
for e in errs[:25]: print("    -", str(e)[:220])

# cualquier cosa que diga FAIL o false en una clave con pinta de comprobacion
print("  --- comprobaciones en FAIL ---")
n=0
for ruta,v in hojas(d):
    if v == "FAIL" or (v is False and any(t in ruta.lower() for t in ("pass","ok","check","within","cover","valid"))):
        print("    ", ruta, "=", v); n+=1
        if n>30: break
print("  --- p99 medidos frente a sus limites ---")
for ruta,v in hojas(d):
    if "p99" in ruta.lower() and isinstance(v,(int,float)):
        print("    ", ruta, "=", v)
PY
echo "PQF_OK"
