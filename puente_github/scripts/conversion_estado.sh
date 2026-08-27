#!/usr/bin/env bash
# Consulta corta del avance de la conversion. Devuelve enseguida: nunca espera.
set +e
LOG=/home/trading/conversion_parquet.log
BASE=/home/trading/jean-flow-exec/staging_runs

if pgrep -f 'conversion_obrero[.]sh' >/dev/null; then
  echo "estado: EN MARCHA"
else
  echo "estado: TERMINADA o no lanzada"
fi
echo "hora UTC: $(date -u +%H:%M:%S)"
echo "CSV que quedan : $(find "$BASE" -name '*.csv' 2>/dev/null | wc -l)"
echo "parquet creados: $(find "$BASE" -name '*.parquet' 2>/dev/null | wc -l)"
df -h /home | tail -1
echo
echo "--- ultimas 30 lineas del registro ---"
tail -30 "$LOG" 2>/dev/null || echo "(sin registro)"
echo "ESTADO_OK"
