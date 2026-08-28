#!/usr/bin/env bash
# v2. En la v1 puse la redireccion de salida FUERA de la funcion que medía, asi
# que la linea de tiempos acababa dentro del JSON del informe: ni medía ni la
# comparacion habria valido nada. Corregido: cada fase recibe su fichero de
# salida como argumento y el tiempo se imprime aparte.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
O=/home/trading/banco_paralelo
PID=/home/trading/banco_paralelo.pid

if ps -eo cmd | grep -E 'binance_collector[.]dual_main' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0; fi

# matar la v1, que estaba midiendo mal
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "  matando el banco v1 (medía mal): pid $(cat "$PID")"
  pkill -P "$(cat "$PID")" 2>/dev/null; kill "$(cat "$PID")" 2>/dev/null
  pkill -f 'binance_collector.audit' 2>/dev/null
  sleep 3
fi
rm -f "$PID"; rm -rf "$O"; mkdir -p "$O/serie" "$O/paralelo"

cat > "$O/correr.sh" <<INNER
#!/usr/bin/env bash
set +e
export PYTHONPATH="$AP/overlay/src"
spot=("$N"/capture/spot/events-*.csv)
usdm=("$N"/capture/usdm_futures/events-*.csv)
met="$N/capture/jean_flow_metrics.jsonl"
echo "ficheros: spot=\${#spot[@]} usdm=\${#usdm[@]} | \$(du -sh "$N/capture" | cut -f1)"
echo "RAM total: \$(free -m | awk '/Mem:/{print \$2}') MB"

fase() {   # \$1 etiqueta  \$2 fichero de salida  \$3.. comando
  local eti="\$1" sal="\$2"; shift 2
  local t0=\$(date +%s%N)
  "\$@" > "\$sal" 2>/dev/null
  local rc=\$?
  local t1=\$(date +%s%N)
  printf "  %-14s %7.1f s  rc=%d\n" "\$eti" "\$(echo "scale=1; (\$t1-\$t0)/1000000000" | bc)" "\$rc"
}

echo
echo "===== A) EN SERIE ====="
T0=\$(date +%s)
fase journal_spot "$O/serie/journal_spot.json" "$PY" -m binance_collector.audit journal "\${spot[@]}"
fase journal_usdm "$O/serie/journal_usdm.json" "$PY" -m binance_collector.audit journal "\${usdm[@]}"
fase identity     "$O/serie/identity.json"     "$PY" -m binance_collector.audit identity "\${spot[@]}" "\${usdm[@]}"
fase metrics      "$O/serie/metrics.json"      "$PY" -m binance_collector.audit metrics --event-loop-p99-ms 20 "\$met"
T1=\$(date +%s)
echo "  ---> TOTAL EN SERIE: \$((T1-T0)) s"

echo
echo "===== B) EN PARALELO ====="
T2=\$(date +%s)
"$PY" -m binance_collector.audit journal "\${spot[@]}" > "$O/paralelo/journal_spot.json" 2>/dev/null & P1=\$!
"$PY" -m binance_collector.audit journal "\${usdm[@]}" > "$O/paralelo/journal_usdm.json" 2>/dev/null & P2=\$!
"$PY" -m binance_collector.audit identity "\${spot[@]}" "\${usdm[@]}" > "$O/paralelo/identity.json" 2>/dev/null & P3=\$!
"$PY" -m binance_collector.audit metrics --event-loop-p99-ms 20 "\$met" > "$O/paralelo/metrics.json" 2>/dev/null & P4=\$!
PICO=0; LOADMAX=0
while kill -0 \$P1 2>/dev/null || kill -0 \$P2 2>/dev/null || kill -0 \$P3 2>/dev/null || kill -0 \$P4 2>/dev/null; do
  U=\$(free -m | awk '/Mem:/{print \$3}'); [ "\$U" -gt "\$PICO" ] && PICO=\$U
  L=\$(cut -d' ' -f1 /proc/loadavg); LOADMAX=\$(echo "\$L \$LOADMAX" | awk '{print (\$1>\$2)?\$1:\$2}')
  sleep 2
done
wait
T3=\$(date +%s)
echo "  ---> TOTAL EN PARALELO: \$((T3-T2)) s"
echo "  pico de memoria: \${PICO} MB   |   pico de carga: \${LOADMAX}"

echo
echo "===== C) ¿SALEN LOS MISMOS INFORMES? ====="
ok=1
for f in journal_spot journal_usdm identity metrics; do
  a=\$(sha256sum "$O/serie/\$f.json" 2>/dev/null | cut -c1-16)
  b=\$(sha256sum "$O/paralelo/\$f.json" 2>/dev/null | cut -c1-16)
  s=\$(stat -c%s "$O/paralelo/\$f.json" 2>/dev/null)
  if [ "\$a" = "\$b" ] && [ -n "\$a" ]; then echo "  \$f: IDENTICO  (\$a, \$s bytes)"
  else echo "  \$f: ***DISTINTO*** serie=\$a paralelo=\$b"; ok=0; fi
done
[ \$ok -eq 1 ] && echo "  ==> el paralelo NO cambia el resultado" || echo "  ==> CUIDADO"
echo BANCO_PARALELO_FIN
INNER
chmod +x "$O/correr.sh"
: > "$O/banco.log"
nohup nice -n 5 bash "$O/correr.sh" >>"$O/banco.log" 2>&1 &
echo $! > "$PID"
echo "lanzado v2 pid $(cat "$PID")"
echo "BP2_LANZADO"
