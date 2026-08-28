#!/usr/bin/env bash
# ¿La memoria del auditor crece con el tamano de la captura?
#
# Importa porque en 7 dias hay 165 veces mas filas que en la captura de una
# hora. Si journal guarda un conjunto de ingest_seq que crece con las filas,
# serian decenas de millones por mercado — varios GB — y identity carga los dos
# mercados a la vez. Con 32 GB puede caber o no.
#
# Metodo: auditar subconjuntos crecientes de la MISMA captura y medir el pico
# de memoria (RSS) contra el numero de filas. Si la curva es plana, no hay
# problema. Si crece con las filas, hay que resolverlo ANTES de los 7 dias.
#
# OJO CON EL ERROR DE AYER: la redireccion va DENTRO, no envolviendo al
# cronometro. Aqui /usr/bin/time escribe a un fichero aparte con -o.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
O=/home/trading/banco_memoria
PID=/home/trading/banco_memoria.pid

if ps -eo cmd | grep -E 'binance_collector[.]dual_main' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0; fi
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "YA CORRIENDO"; tail -8 "$O/banco.log"; exit 0; fi
rm -rf "$O"; mkdir -p "$O"

cat > "$O/correr.sh" <<INNER
#!/usr/bin/env bash
set +e
export PYTHONPATH="$AP/overlay/src"
usdm=(\$(ls -1 "$N"/capture/usdm_futures/events-*.csv | sort))
echo "ficheros disponibles: \${#usdm[@]}"
echo
printf "%9s %14s %14s %12s %12s\n" "ficheros" "bytes" "filas" "pico_RSS_MB" "segundos"

for k in 1 2 4 7 10; do
  [ \$k -gt \${#usdm[@]} ] && continue
  sub=("\${usdm[@]:0:\$k}")
  bytes=\$(du -cb "\${sub[@]}" | tail -1 | cut -f1)
  t0=\$(date +%s)
  /usr/bin/time -f "%M" -o "$O/rss_\$k.txt" \\
     "$PY" -m binance_collector.audit journal "\${sub[@]}" > "$O/informe_\$k.json" 2>/dev/null
  t1=\$(date +%s)
  rss=\$(cat "$O/rss_\$k.txt" 2>/dev/null | tail -1)
  filas=\$("$PY" -c "
import json
try:
    d=json.load(open('$O/informe_\$k.json'))
    print((d.get('causal_identity') or {}).get('unique_ingest_seq_count','?'))
except Exception: print('?')
")
  printf "%9d %14d %14s %12s %12d\n" "\$k" "\$bytes" "\$filas" "\$(echo "scale=1; \$rss/1024" | bc)" "\$((t1-t0))"
done

echo
echo "===== LECTURA ====="
"$PY" - <<'PYCODE'
import glob, json, os
filas=[]; rss=[]
for k in (1,2,4,7,10):
    r="/home/trading/banco_memoria/rss_%d.txt"%k
    i="/home/trading/banco_memoria/informe_%d.json"%k
    if not (os.path.exists(r) and os.path.exists(i)): continue
    try:
        m=int(open(r).read().strip().splitlines()[-1])
        d=json.load(open(i)); n=(d.get("causal_identity") or {}).get("unique_ingest_seq_count")
        if n: filas.append(n); rss.append(m/1024.0)
    except Exception: pass
if len(filas)>=2:
    print("  filas -> MB:", ", ".join(f"{n:,}->{m:.0f}MB" for n,m in zip(filas,rss)))
    crec=(rss[-1]-rss[0])/max(1,(filas[-1]-filas[0]))
    print(f"  pendiente: {crec*1_000_000:.1f} MB por cada millon de filas")
    print(f"  base (interprete y codigo): ~{rss[0]-crec*filas[0]:.0f} MB")
    # proyeccion a 7 dias con el ritmo de la captura de hoy
    por_hora = filas[-1] / 1.0    # la captura fue de ~1 h
    siete = por_hora*24*7
    proy = (rss[0]-crec*filas[0]) + crec*siete
    print(f"  filas estimadas en 7 dias (a este ritmo): {siete:,.0f}")
    print(f"  PROYECCION de memoria para journal de 7 dias: {proy:,.0f} MB")
    print(f"  RAM de la maquina: 32090 MB")
    print("  VEREDICTO:", "CABE" if proy < 20000 else "***NO CABE / MUY JUSTO***")
else:
    print("  no hay suficientes puntos")
PYCODE
echo BANCO_MEMORIA_FIN
INNER
chmod +x "$O/correr.sh"
: > "$O/banco.log"
nohup nice -n 5 bash "$O/correr.sh" >>"$O/banco.log" 2>&1 &
echo $! > "$PID"
echo "lanzado pid $(cat "$PID")"
echo "BM_LANZADO"
