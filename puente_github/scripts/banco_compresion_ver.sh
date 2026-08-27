#!/usr/bin/env bash
# Consulta corta del banco de compresores. Devuelve enseguida.
set +e
LOG=/home/trading/banco_compresion.log
if pgrep -f 'banco_compresion_obrero' >/dev/null; then
  echo "estado: EN MARCHA"
else
  echo "estado: TERMINADO o no lanzado"
fi
echo "hora UTC: $(date -u +%H:%M:%S)"
echo
tail -45 "$LOG" 2>/dev/null || echo "(sin registro)"
echo "VER_BANCO_COMP_OK"
