#!/usr/bin/env bash
# ¿Que queda sin comprimir? Los CSV viejos de restore_stage ocupan disco que
# hara falta para los 7 dias. Antes de convertir nada, mirar que hay.
set +e
echo "=== disco ==="
df -h /home | tail -1

echo
echo "=== donde estan los CSV grandes que quedan ==="
du -sh /home/trading/restore_stage_20260825 2>/dev/null
echo "--- por subdirectorio (top 12) ---"
du -sh /home/trading/restore_stage_20260825/*/ 2>/dev/null | sort -rh | head -12

echo
echo "=== cuantos CSV, cuanto pesan, cuantos ya tienen Parquet al lado ==="
find /home/trading/restore_stage_20260825 -name '*.csv' -type f 2>/dev/null \
  | awk 'END{print "  ficheros .csv:", NR}'
find /home/trading/restore_stage_20260825 -name '*.csv' -type f -printf '%s\n' 2>/dev/null \
  | awk '{s+=$1} END{printf "  suman: %.2f GiB\n", s/1073741824}'
find /home/trading/restore_stage_20260825 -name '*.parquet' -type f 2>/dev/null \
  | awk 'END{print "  ficheros .parquet ya presentes:", NR}'
echo "  .csv.partial (EN USO, no se tocan):"
find /home/trading/restore_stage_20260825 -name '*.csv.partial' 2>/dev/null | wc -l

echo
echo "=== ¿hay estructura de captura (capture/ y manifiesto)? ==="
find /home/trading/restore_stage_20260825 -maxdepth 3 -name 'capture' -type d 2>/dev/null | head -5
find /home/trading/restore_stage_20260825 -maxdepth 4 -name 'manifest*' 2>/dev/null | head -5

echo
echo "=== ¿hay alguna captura activa ahora mismo? (si la hay, no se toca nada) ==="
ps -eo pid,etime,cmd | grep -E 'dual_main|binance_collector' | grep -v grep || echo "  ninguna"
echo "VER_CSV_VIEJOS_OK"
