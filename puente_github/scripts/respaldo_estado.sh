#!/usr/bin/env bash
# Consulta corta del respaldo. Devuelve enseguida.
set +e
LOG=/home/trading/respaldo_maestro.log
if pgrep -f 'respaldo_maestro[.]py' >/dev/null; then
  echo "estado: EN MARCHA"
else
  echo "estado: TERMINADO o no lanzado"
fi
echo "hora UTC: $(date -u +%H:%M:%S)"
echo
echo "--- ficheros de respaldo en disco ---"
ls -lah /home/trading/RESPALDO_JEAN_FLOW_*.zip* 2>/dev/null || echo "(ninguno todavia)"
echo
echo "--- ultimas 25 lineas del registro ---"
tail -25 "$LOG" 2>/dev/null || echo "(sin registro)"
echo "RESPALDO_ESTADO_OK"
