#!/usr/bin/env bash
# Convierte a Parquet los 21.34 GiB de CSV viejos de restore_stage_20260825.
#
# SIN --borrar. Esta pasada solo GENERA. El borrado, si se hace, sera una
# segunda orden despues de ver el manifiesto. Asi el fallo, si lo hay, se
# descubre con los originales todavia en disco.
#
# Se lanza DESPEGADO (nohup) porque 21 GiB no caben en el tiempo de una orden
# del puente. Meterlo en linea seria bloquear la cola otra vez.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
DIR=/home/trading/restore_stage_20260825/ubuntu
LOG=/home/trading/conversion_viejos.log
PID=/home/trading/conversion_viejos.pid

echo "=== guardas antes de lanzar ==="
if ps -eo cmd | grep -E 'dual_main|binance_collector' | grep -v grep >/dev/null; then
  echo "  HAY UNA CAPTURA ACTIVA -> NO SE LANZA NADA"; echo "ABORTADO"; exit 0
fi
echo "  captura activa: ninguna"

if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "  YA HAY UNA CONVERSION CORRIENDO (pid $(cat "$PID")) -> no se duplica"
  tail -5 "$LOG" 2>/dev/null
  echo "YA_CORRIENDO"; exit 0
fi
echo "  conversion previa: ninguna viva"

FREE=$(df --output=avail -BG /home | tail -1 | tr -dc '0-9')
echo "  libres: ${FREE} GiB"
if [ "${FREE:-0}" -lt 10 ]; then echo "  MENOS DE 10 GiB LIBRES -> ABORTADO"; exit 0; fi

echo
echo "=== lanzando (sin --borrar) ==="
: > "$LOG"
nohup nice -n 10 "$PY" "$H" --staging "$DIR" >>"$LOG" 2>&1 &
echo $! > "$PID"
echo "  pid: $(cat "$PID")"
sleep 20
echo
echo "=== primeras lineas del log (20 s despues) ==="
tail -20 "$LOG"
echo "LANZADO_OK"
