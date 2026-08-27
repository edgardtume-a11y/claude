#!/usr/bin/env bash
# Consulta corta del banco del GIL. Devuelve enseguida: nunca espera.
set +e
LOG=/home/trading/banco_gil.log
if pgrep -f 'banco_gil[.]py' >/dev/null; then
  echo "estado: EN MARCHA"
else
  echo "estado: TERMINADO o no lanzado"
fi
echo "hora UTC: $(date -u +%H:%M:%S)"
echo
echo "--- registro completo (ultimas 60 lineas) ---"
tail -60 "$LOG" 2>/dev/null || echo "(sin registro)"
echo "BANCO_ESTADO_OK"
