#!/usr/bin/env bash
# BANCO DE PRUEBAS: ¿el auditor que lee Parquet certifica igual que el que lee CSV?
#
# La verdad son los informes que el gate 4 ya produjo el 27/08 y que estan
# certificados con codigo 0 en las cuatro fases. Sus CSV ya no existen: fueron
# convertidos a Parquet. Es decir, el problema no es hipotetico, es el de hoy.
#
# Se comprueban TRES caminos y deben coincidir los tres:
#   1. viejo sobre CSV      -> el informe guardado (la verdad)
#   2. nuevo sobre Parquet  -> debe dar lo mismo
#   3. nuevo sobre CSV reconstruido -> debe dar lo mismo (el cambio es invisible para CSV)
#
# El criterio: identicos en TODO menos el campo "files", que legitimamente
# nombra .parquet en vez de .csv. Y dentro de eso, replay.sha256 —el hash
# canonico del libro— es el numero que decide: si una sola fila cambiara, cambia.
set +e
G=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
NUEVO=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*auditparquet* 2>/dev/null | head -1)
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
OUT=/home/trading/banco_auditparquet
LOG=$OUT/banco.log
PID=/home/trading/banco_auditparquet.pid

if [ -z "$NUEVO" ]; then echo "TODAVIA NO HAY STAGING auditparquet"; exit 0; fi
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "YA CORRIENDO"; tail -5 "$LOG"; exit 0; fi
if ps -eo cmd | grep -E 'dual_main|binance_collector.collector' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0
fi

mkdir -p "$OUT/csv_reconstruido" "$OUT/informes"
cat > "$OUT/correr.sh" <<INNER
#!/usr/bin/env bash
set +e
export PYTHONPATH="$NUEVO/overlay/src"
cd "$OUT"

echo "== 1) reconstruir CSV desde los Parquet del gate 4 (byte a byte) =="
for p in "$G"/capture/spot/*.parquet; do
  "$PY" /home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py \\
    --parquet "\$p" --destino "$OUT/csv_reconstruido/spot_\$(basename "\$p" .parquet).csv"
done
for p in "$G"/capture/usdm_futures/*.parquet; do
  "$PY" /home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py \\
    --parquet "\$p" --destino "$OUT/csv_reconstruido/usdm_\$(basename "\$p" .parquet).csv"
done
ls -l "$OUT/csv_reconstruido/"

echo
echo "== 2) auditor NUEVO sobre PARQUET =="
"$PY" -m binance_collector.audit journal "$G"/capture/spot/*.parquet \\
  > "$OUT/informes/pq_journal_spot.json" 2> "$OUT/informes/pq_journal_spot.err"; echo "  journal_spot rc=\$?"
"$PY" -m binance_collector.audit journal "$G"/capture/usdm_futures/*.parquet \\
  > "$OUT/informes/pq_journal_usdm.json" 2> "$OUT/informes/pq_journal_usdm.err"; echo "  journal_usdm rc=\$?"
"$PY" -m binance_collector.audit identity "$G"/capture/spot/*.parquet "$G"/capture/usdm_futures/*.parquet \\
  > "$OUT/informes/pq_identity.json" 2> "$OUT/informes/pq_identity.err"; echo "  identity rc=\$?"

echo
echo "== 3) auditor NUEVO sobre CSV RECONSTRUIDO =="
"$PY" -m binance_collector.audit journal "$OUT"/csv_reconstruido/spot_*.csv \\
  > "$OUT/informes/csv_journal_spot.json" 2> "$OUT/informes/csv_journal_spot.err"; echo "  journal_spot rc=\$?"
"$PY" -m binance_collector.audit journal "$OUT"/csv_reconstruido/usdm_*.csv \\
  > "$OUT/informes/csv_journal_usdm.json" 2> "$OUT/informes/csv_journal_usdm.err"; echo "  journal_usdm rc=\$?"
"$PY" -m binance_collector.audit identity "$OUT"/csv_reconstruido/spot_*.csv "$OUT"/csv_reconstruido/usdm_*.csv \\
  > "$OUT/informes/csv_identity.json" 2> "$OUT/informes/csv_identity.err"; echo "  identity rc=\$?"

echo
echo "== 4) EL VEREDICTO =="
"$PY" - <<'PYCODE'
import json, sys
G="$G"; OUT="$OUT"
def cargar(p):
    try: return json.load(open(p))
    except Exception as e: return {"__error__": str(e)}
def limpiar(d):
    # "files" nombra las rutas y cambia legitimamente entre csv y parquet
    if isinstance(d, dict):
        d = {k: v for k, v in d.items() if k != "files"}
        return {k: limpiar(v) for k, v in sorted(d.items())}
    if isinstance(d, list): return [limpiar(x) for x in d]
    return d
def dif(a, b, ruta=""):
    out=[]
    if type(a)!=type(b): return [f"{ruta}: tipos {type(a).__name__} vs {type(b).__name__}"]
    if isinstance(a,dict):
        for k in sorted(set(a)|set(b)):
            if k not in a: out.append(f"{ruta}/{k}: solo en el nuevo")
            elif k not in b: out.append(f"{ruta}/{k}: solo en la verdad")
            else: out += dif(a[k], b[k], f"{ruta}/{k}")
    elif isinstance(a,list):
        if len(a)!=len(b): out.append(f"{ruta}: longitudes {len(a)} vs {len(b)}")
        else:
            for i,(x,y) in enumerate(zip(a,b)): out += dif(x,y,f"{ruta}[{i}]")
    elif a!=b: out.append(f"{ruta}: {a!r} != {b!r}")
    return out

casos = [("journal_spot","pq_journal_spot","csv_journal_spot"),
         ("journal_usdm","pq_journal_usdm","csv_journal_usdm"),
         ("identity","pq_identity","csv_identity")]
todo_ok = True
for verdad, pq, csv in casos:
    v = limpiar(cargar(f"{G}/audit/{verdad}.json"))
    p = limpiar(cargar(f"{OUT}/informes/{pq}.json"))
    c = limpiar(cargar(f"{OUT}/informes/{csv}.json"))
    print(f"\n--- {verdad} ---")
    for nombre, otro in (("nuevo sobre PARQUET", p), ("nuevo sobre CSV reconstruido", c)):
        d = dif(otro, v)
        if not d: print(f"  {nombre}: IDENTICO")
        else:
            todo_ok = False
            print(f"  {nombre}: {len(d)} DIFERENCIAS")
            for x in d[:12]: print("     ", x)
    h_v = (v.get("replay") or {}).get("sha256")
    h_p = (p.get("replay") or {}).get("sha256")
    h_c = (c.get("replay") or {}).get("sha256")
    if h_v or h_p or h_c:
        print(f"  hash canonico del libro:")
        print(f"     verdad  : {h_v}")
        print(f"     parquet : {h_p}  {'IGUAL' if h_p==h_v else '***DISTINTO***'}")
        print(f"     csv rec.: {h_c}  {'IGUAL' if h_c==h_v else '***DISTINTO***'}")
        if h_p!=h_v or h_c!=h_v: todo_ok = False
print("\n" + ("VEREDICTO: IDENTICOS" if todo_ok else "VEREDICTO: HAY DIFERENCIAS"))
PYCODE
echo BANCO_FINALIZADO
INNER
chmod +x "$OUT/correr.sh"

: > "$LOG"
nohup nice -n 5 bash "$OUT/correr.sh" >>"$LOG" 2>&1 &
echo $! > "$PID"
echo "lanzado pid $(cat "$PID"); staging nuevo: $NUEVO"
sleep 60
echo "--- log a los 60 s ---"; tail -25 "$LOG"
echo "BANCO_LANZADO"
