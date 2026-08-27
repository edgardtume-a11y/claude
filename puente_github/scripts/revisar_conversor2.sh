#!/usr/bin/env bash
# Lectura literal del bloque que borra. Los comentarios no protegen datos:
# lo que protege es la estructura del if.
set +e
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py

echo "=== A) la funcion que autoriza el borrado ==="
sed -n "/def es_seguro_borrar_csv/,/^def /p" "$H" | head -40

echo
echo "=== B) definicion de la bandera --borrar ==="
grep -n -A3 '\-\-borrar' "$H" | head -12

echo
echo "=== C) EL BLOQUE DE BORRADO LITERAL, lineas 300-350 ==="
sed -n '300,350p' "$H" | cat -n | sed 's/^/   /'
echo "REVISION2_OK"
