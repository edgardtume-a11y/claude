#!/usr/bin/env bash
# Lanza el banco de compresores en segundo plano y devuelve enseguida.
set +e
OBRERO=/home/trading/puente_github_repo/puente_github/scripts/banco_compresion_obrero.sh
LOG=/home/trading/banco_compresion.log

if pgrep -f 'banco_compresion_obrero' >/dev/null; then
  echo "YA ESTA CORRIENDO"
  tail -20 "$LOG" 2>/dev/null
  exit 0
fi
nohup bash "$OBRERO" > "$LOG" 2>&1 &
echo "lanzado pid=$!"
echo "registro: $LOG"
echo "LANZAR_OK"
