#!/usr/bin/env bash
set +e
PID=/home/trading/banco_paralelo.pid
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "CORRIENDO"; else echo "TERMINADO"; fi
echo "--- log ---"
cat /home/trading/banco_paralelo/banco.log 2>/dev/null
echo "--- carga y memoria ahora ---"
cat /proc/loadavg; free -m | awk '/Mem:/{print "  usada "$3" MB de "$2" MB"}'
echo "VBP_OK"
