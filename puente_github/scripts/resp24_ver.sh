#!/usr/bin/env bash
# Consulta corta del respaldo del 24 en adelante. Devuelve enseguida.
set +e
LOG=/home/trading/respaldo_24.log
DEST=/home/trading/respaldo_24_27
if pgrep -f 'respaldo_total_obrero' >/dev/null; then
  echo "estado: EN MARCHA"
else
  echo "estado: TERMINADO o no lanzado"
fi
echo "hora UTC: $(date -u +%H:%M:%S)"
echo
echo "--- partes generadas ---"
ls -lah "$DEST"/*.zip 2>/dev/null || echo "(ninguna todavia)"
ls -lah "$DEST"/*.escribiendo 2>/dev/null
echo
df -h /home | tail -1
echo
echo "--- ultimas 30 lineas ---"
tail -30 "$LOG" 2>/dev/null || echo "(sin registro)"
echo "VER_24_OK"
