#!/usr/bin/env bash
# ¿Se puede auditar en paralelo? Las cuatro fases son de SOLO LECTURA y
# escriben a ficheros distintos. La maquina tiene 8 nucleos y usa uno.
#
# Pero antes de afirmarlo hay que MEDIRLO: cuatro procesos leyendo CSV grandes
# a la vez podrian competir por memoria o disco y salir PEOR. Es la leccion de
# los 19 ms: no optimizar contra un numero que no se ha comprobado.
#
# Se mide sobre la captura real de 61 minutos del operador (6.5 GB), que ya
# fue auditada en serie y tardo ~10 minutos.
# TODO SOLO LECTURA sobre la captura. Las salidas van a otro sitio.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
O=/home/trading/banco_paralelo
PID=/home/trading/banco_paralelo.pid

if ps -eo cmd | grep -E 'binance_collector[.]dual_main' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0; fi
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "YA CORRIENDO"; tail -5 "$O/banco.log"; exit 0; fi

mkdir -p "$O/serie" "$O/paralelo"
cat > "$O/correr.sh" <<INNER
#!/usr/bin/env bash
set +e
export PYTHONPATH="$AP/overlay/src"
spot=("$N"/capture/spot/events-*.csv)
usdm=("$N"/capture/usdm_futures/events-*.csv)
met="$N/capture/jean_flow_metrics.jsonl"
echo "ficheros: spot=\${#spot[@]} usdm=\${#usdm[@]}"
echo "tamano:   \$(du -sh "$N/capture" | cut -f1)"
echo "memoria libre antes: \$(free -m | awk '/Mem:/{print \$7" MB disponibles"}')"

medir() { /usr/bin/time -f "%e s  %M KB pico" "\$@" 2>&1 | tail -1; }

echo
echo "===== A) EN SERIE (como se hace hoy) ====="
T0=\$(date +%s)
echo -n "  journal_spot : "; medir "$PY" -m binance_collector.audit journal "\${spot[@]}" > "$O/serie/journal_spot.json" 2>/dev/null
echo -n "  journal_usdm : "; medir "$PY" -m binance_collector.audit journal "\${usdm[@]}" > "$O/serie/journal_usdm.json" 2>/dev/null
echo -n "  identity     : "; medir "$PY" -m binance_collector.audit identity "\${spot[@]}" "\${usdm[@]}" > "$O/serie/identity.json" 2>/dev/null
echo -n "  metrics      : "; medir "$PY" -m binance_collector.audit metrics --event-loop-p99-ms 20 "\$met" > "$O/serie/metrics.json" 2>/dev/null
T1=\$(date +%s)
echo "  TOTAL EN SERIE: \$((T1-T0)) s"

echo
echo "===== B) EN PARALELO (las cuatro a la vez) ====="
T2=\$(date +%s)
"$PY" -m binance_collector.audit journal "\${spot[@]}" > "$O/paralelo/journal_spot.json" 2>/dev/null &
P1=\$!
"$PY" -m binance_collector.audit journal "\${usdm[@]}" > "$O/paralelo/journal_usdm.json" 2>/dev/null &
P2=\$!
"$PY" -m binance_collector.audit identity "\${spot[@]}" "\${usdm[@]}" > "$O/paralelo/identity.json" 2>/dev/null &
P3=\$!
"$PY" -m binance_collector.audit metrics --event-loop-p99-ms 20 "\$met" > "$O/paralelo/metrics.json" 2>/dev/null &
P4=\$!
# vigilar memoria mientras corren
PICO=0
while kill -0 \$P1 2>/dev/null || kill -0 \$P2 2>/dev/null || kill -0 \$P3 2>/dev/null || kill -0 \$P4 2>/dev/null; do
  USO=\$(free -m | awk '/Mem:/{print \$3}')
  [ "\$USO" -gt "\$PICO" ] && PICO=\$USO
  sleep 2
done
wait
T3=\$(date +%s)
echo "  TOTAL EN PARALELO: \$((T3-T2)) s"
echo "  pico de memoria usada durante el paralelo: \${PICO} MB de \$(free -m | awk '/Mem:/{print \$2}') MB"

echo
echo "===== C) ¿SALEN LOS MISMOS INFORMES? ====="
todo=1
for f in journal_spot journal_usdm identity metrics; do
  a=\$(sha256sum "$O/serie/\$f.json" 2>/dev/null | cut -c1-16)
  b=\$(sha256sum "$O/paralelo/\$f.json" 2>/dev/null | cut -c1-16)
  if [ "\$a" = "\$b" ] && [ -n "\$a" ]; then echo "  \$f: IDENTICO (\$a)"; else echo "  \$f: ***DISTINTO*** serie=\$a paralelo=\$b"; todo=0; fi
done
[ \$todo -eq 1 ] && echo "  --> el paralelo NO cambia el resultado" || echo "  --> CUIDADO: el paralelo cambia algo"
echo BANCO_PARALELO_FIN
INNER
chmod +x "$O/correr.sh"
: > "$O/banco.log"
nohup nice -n 5 bash "$O/correr.sh" >>"$O/banco.log" 2>&1 &
echo $! > "$PID"
echo "lanzado pid $(cat "$PID")"
sleep 45
tail -12 "$O/banco.log"
echo "BP_LANZADO"
