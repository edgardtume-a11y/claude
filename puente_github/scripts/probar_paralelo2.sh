#!/usr/bin/env bash
# v2: la v1 se mató sola con un `timeout 100` sobre algo que tarda 245 s.
# Ahora se lanza despegado y se consulta aparte, que es la regla de esta casa
# para todo lo que dura más de los 120 s del puente.
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
T=/home/trading/prueba_paralelo
G=/home/trading/puente_github_repo/puente_github/scripts/run_live_audits_paralelo.sh
PID=/home/trading/prueba_paralelo.pid

if ps -eo cmd | grep -E 'binance_collector[.]dual_main' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0; fi
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "YA CORRIENDO"; exit 0; fi

rm -rf "$T"; mkdir -p "$T"
ln -s "$N/capture" "$T/capture"; ln -s "$AP/overlay" "$T/overlay"
nohup nice -n 5 bash "$G" "$T" > "$T/salida.log" 2>&1 &
echo $! > "$PID"
echo "lanzado pid $(cat "$PID"); tarda ~245 s"
echo "PP2_LANZADO"
