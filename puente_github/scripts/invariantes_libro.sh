#!/usr/bin/env bash
# Lo que mas me preocupa del gate: 8 violaciones de invariante del libro en
# futuros y 2 en spot, con 22 resincronizaciones contra 1 del gate 4.
# Los p99 son calidad; esto es el libro diciendo que no cuadra.
# TODO SOLO LECTURA. No hay captura activa, pero no se toca nada igualmente.
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
M="$N/capture/jean_flow_metrics.jsonl"

echo "=== 1) ¿que contadores de fallo hay, y como crecieron? ==="
python3 - <<PY
import json, re
ruta="$M"
claves=("book_invariant_failures","book_boundary_hard_failures","book_syncs",
        "reconnections","book_prevented","depth_gap","resyncs","websocket_errors")
series={}
with open(ruta, errors="ignore") as fh:
    for linea in fh:
        try: d=json.loads(linea)
        except Exception: continue
        m=d.get("message","")
        if not m.startswith("metrics market="): continue
        mercado=m.split("market=",1)[1].split(" ",1)[0]
        try: cuerpo=json.loads(m.split(" ",2)[2])
        except Exception: continue
        c=cuerpo.get("counters",{})
        for k,v in c.items():
            if any(t in k for t in claves):
                series.setdefault((mercado,k),[]).append((d.get("timestamp"),v))
for (mer,k),vals in sorted(series.items()):
    ini=vals[0][1]; fin=vals[-1][1]
    if fin==0: continue
    # ¿cuando aparecieron?
    saltos=[t for (t,v),(t2,v2) in zip(vals, vals[1:]) if v2>v]
    print(f"  {mer:14s} {k:34s} final={fin}")
    if saltos and fin<50:
        print(f"      subio en: {', '.join(s[11:19] for s in saltos[:12])}")
PY

echo
echo "=== 2) errores y avisos en el log ==="
grep -iE '"level":"(ERROR|WARNING)"' "$M" 2>/dev/null | head -12 | cut -c1-260

echo
echo "=== 3) ¿hubo desconexiones? ==="
grep -oiE 'reconnect[^,"]*' "$M" 2>/dev/null | sort | uniq -c | sort -rn | head -8
grep -icE 'BookBoundaryError' "$M" | sed 's/^/  menciones de BookBoundaryError: /'
grep -iE 'BookBoundaryError' "$M" 2>/dev/null | head -3 | cut -c1-300

echo
echo "=== 4) ¿el auditor lo dio por bueno? ¿que dice journal de futuros? ==="
python3 - <<PY
import json
d=json.load(open("$N/audit/journal_usdm.json"))
print("  certification:", json.dumps(d.get("certification"), ensure_ascii=False)[:400])
print("  book_statuses:", d.get("book_statuses"))
print("  delta_dispositions:", d.get("delta_dispositions"))
r=d.get("replay") or {}
print("  ingest_conflicts:", r.get("ingest_conflicts"), "| snapshots:", r.get("snapshots"), "| generation:", r.get("generation"))
print("  incomplete_markers:", d.get("incomplete_markers"))
PY
echo "IL_OK"
