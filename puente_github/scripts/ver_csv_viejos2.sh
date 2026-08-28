#!/usr/bin/env bash
# Antes de comprimir 21 GiB hay que saber QUE son y si ya estan respaldados.
# Comprimir algo que sobra es trabajo perdido; borrarlo sin saberlo es peor.
set +e
D=/home/trading/restore_stage_20260825/ubuntu

echo "=== 1) el arbol, hasta 5 niveles ==="
find "$D" -maxdepth 5 -type d 2>/dev/null | head -30

echo
echo "=== 2) los 12 CSV mas grandes: ruta, tamano, fecha ==="
find "$D" -name '*.csv' -type f -printf '%s\t%TY-%Tm-%Td\t%p\n' 2>/dev/null | sort -rn | head -12 \
 | awk -F'\t' '{printf "  %7.2f GiB  %s  %s\n", $1/1073741824, $2, $3}'

echo
echo "=== 3) ¿que forma tienen? cabecera del mayor ==="
MAY=$(find "$D" -name '*.csv' -type f -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -1 | cut -f2)
echo "  fichero: $MAY"
head -1 "$MAY" 2>/dev/null | tr ',' '\n' | wc -l | sed 's/^/  columnas: /'
head -1 "$MAY" 2>/dev/null | cut -c1-200
echo "  ---"
sed -n '2p' "$MAY" 2>/dev/null | cut -c1-200

echo
echo "=== 4) ¿ESTO YA ESTA EN EL RESPALDO? ==="
INV=$(ls /home/trading/respaldo_24_27/*inventario* /home/trading/respaldo_24_27/*INVENTARIO* 2>/dev/null | head -1)
echo "  inventario: ${INV:-NO ENCONTRADO}"
if [ -n "$INV" ]; then
  echo -n "  lineas del inventario que mencionan restore_stage_20260825: "
  grep -c 'restore_stage_20260825' "$INV" 2>/dev/null
fi
ls -l /home/trading/respaldo_24_27/ 2>/dev/null | head -5
echo "  partes del respaldo:"; ls /home/trading/respaldo_24_27/ 2>/dev/null | wc -l

echo
echo "=== 5) espacio ==="
df -h /home | tail -1
echo "VER2_OK"
