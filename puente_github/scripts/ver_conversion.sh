#!/usr/bin/env bash
set +e
LOG=/home/trading/conversion_viejos.log
PID=/home/trading/conversion_viejos.pid
DIR=/home/trading/restore_stage_20260825/ubuntu
echo "=== ¿sigue viva? ==="
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "  VIVA (pid $(cat "$PID"))"; ps -o etime=,%cpu=,rss= -p "$(cat "$PID")"
else
  echo "  TERMINADA"
fi
echo
echo "=== progreso ==="
echo -n "  CSV que quedan: "; find "$DIR" -name '*.csv' -type f 2>/dev/null | wc -l
echo -n "  Parquet generados: "; find "$DIR" -name '*.parquet' -type f 2>/dev/null | wc -l
find "$DIR" -name '*.csv' -type f -printf '%s\n' 2>/dev/null | awk '{s+=$1}END{printf "  CSV pesan: %.2f GiB\n", s/1073741824}'
find "$DIR" -name '*.parquet' -type f -printf '%s\n' 2>/dev/null | awk '{s+=$1}END{printf "  Parquet pesan: %.3f GiB\n", s/1073741824}'
echo
echo "=== ultimas 25 lineas del log ==="
tail -25 "$LOG" 2>/dev/null
echo
echo "=== disco ==="; df -h /home | tail -1
echo "VER_CONV_OK"
