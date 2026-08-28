#!/usr/bin/env bash
# Corto a proposito: el ejecutor del puente corta a los 120 s.
set +e
DIR=/home/trading/restore_stage_20260825/ubuntu
PID=/home/trading/borrado_viejos.pid
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "CORRIENDO pid $(cat "$PID")"; ps -o etime=,%cpu= -p "$(cat "$PID")"; else echo "TERMINADO"; fi
echo -n "CSV que quedan: "; find "$DIR" -name '*.csv' -type f | wc -l
echo -n "Parquet: "; find "$DIR" -name '*.parquet' -type f | wc -l
du -sh "$DIR" 2>/dev/null
grep -E 'RESUMEN|Ficheros procesados|Fallos|GiB|Factor|ERROR|Traceback' /home/trading/borrado_viejos.log 2>/dev/null | tail -12
grep -c 'BORRADO' /home/trading/borrado_viejos.log 2>/dev/null | sed 's/^/lineas BORRADO: /'
df -h /home | tail -1
echo "VB_OK"
