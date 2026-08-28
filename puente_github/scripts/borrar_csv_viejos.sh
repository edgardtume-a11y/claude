#!/usr/bin/env bash
# Segunda pasada: --borrar. El conversor REVERIFICA en esta misma ejecucion
# (manifiesto, numero de filas, columnas, valores como texto y sha256) y solo
# entonces borra el CSV. La primera pasada ya dejo los 60 Parquet en disco.
#
# Red de seguridad adicional: estos mismos ficheros estan dentro del respaldo
# completo de 35 partes del 28/08 03:08.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
DIR=/home/trading/restore_stage_20260825/ubuntu
LOG=/home/trading/borrado_viejos.log
PID=/home/trading/borrado_viejos.pid

if ps -eo cmd | grep -E 'dual_main|binance_collector' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0
fi
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "YA CORRIENDO (pid $(cat "$PID"))"; tail -3 "$LOG"; exit 0
fi

echo "antes:"; df -h /home | tail -1
find "$DIR" -name '*.csv' -type f -printf '%s\n' | awk '{s+=$1}END{printf "  CSV: %d ficheros?  %.2f GiB\n", NR, s/1073741824}'
find "$DIR" -name '*.parquet' -type f | wc -l | sed 's/^/  Parquet presentes: /'

: > "$LOG"
nohup nice -n 10 "$PY" "$H" --staging "$DIR" --borrar >>"$LOG" 2>&1 &
echo $! > "$PID"
echo "lanzado pid $(cat "$PID")"

for i in $(seq 1 40); do
  if [ ! -f "$PID" ] || ! kill -0 "$(cat "$PID")" 2>/dev/null; then break; fi
  sleep 5
done

echo
echo "=== estado ==="
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "  SIGUE CORRIENDO"; else echo "  TERMINADO"; fi
echo -n "  CSV que quedan: "; find "$DIR" -name '*.csv' -type f | wc -l
echo -n "  Parquet: "; find "$DIR" -name '*.parquet' -type f | wc -l
echo "=== resumen del log ==="
grep -E 'RESUMEN|Ficheros|Fallos|GiB|Factor|BORRADO|ERROR|Traceback' "$LOG" | tail -20
echo "despues:"; df -h /home | tail -1
echo "BORRADO_OK"
