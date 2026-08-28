#!/usr/bin/env bash
# ¿Que hay exactamente en los 22 GB de capturas antiguas?
# Antes de comprimir y borrar hay que saber que se toca: cuantos ficheros, de
# que capturas, y si alguno esta a medias.
set +e
R=/home/trading/restore_stage_20260825

echo "=== 1) tamano total ==="
du -sh "$R" 2>/dev/null

echo
echo "=== 2) cuantos CSV y cuanto pesan ==="
N=$(find "$R" -name '*.csv' 2>/dev/null | wc -l)
B=$(find "$R" -name '*.csv' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
echo "  ficheros csv: $N"
awk -v b="$B" 'BEGIN{printf "  bytes: %d (%.2f GiB)\n", b, b/1073741824}'

echo
echo "=== 3) ¿hay ficheros a medias? (NO se deben tocar) ==="
find "$R" -name '*.partial' -o -name '*.tmp' 2>/dev/null | wc -l

echo
echo "=== 4) ¿ya hay parquet ahi? ==="
find "$R" -name '*.parquet' 2>/dev/null | wc -l

echo
echo "=== 5) las capturas que contiene ==="
find "$R" -type d -name capture 2>/dev/null | head -20 | while read -r d; do
  t=$(du -sh "$d" 2>/dev/null | cut -f1)
  n=$(find "$d" -name '*.csv' | wc -l)
  echo "  $t  [$n csv]  ${d#$R/}"
done

echo
echo "=== 6) que NO son CSV dentro de esa carpeta (para saber que se conserva) ==="
find "$R" -type f -not -name '*.csv' -printf '%s\n' 2>/dev/null \
  | awk '{s+=$1; n++} END{printf "  %d ficheros, %.2f MiB\n", n, s/1048576}'

echo
echo "=== 7) proyeccion ==="
awk -v b="$B" 'BEGIN{printf "  a 65x: %.2f GiB -> %.0f MiB   (se liberarian %.1f GiB)\n", b/1073741824, b/65/1048576, (b-b/65)/1073741824}'
echo "CENSO_VIEJAS_OK"
