#!/usr/bin/env bash
set +e
PID=/home/trading/banco_memoria.pid
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "CORRIENDO"; else echo "TERMINADO"; fi
cat /home/trading/banco_memoria/banco.log 2>/dev/null
echo "VBM_OK"
