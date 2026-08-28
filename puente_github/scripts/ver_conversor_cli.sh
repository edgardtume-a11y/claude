#!/usr/bin/env bash
# Antes de lanzar una conversion de 21 GiB hay que saber exactamente que
# argumentos acepta la herramienta. Un flag mal puesto sobre 60 ficheros no
# es un error: es un incidente.
set +e
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
echo "=== argumentos que acepta ==="
grep -n 'add_argument' "$H" | head -25
echo
echo "=== el valor por defecto de --borrar ==="
grep -n -B2 -A4 "'--borrar'\|\"--borrar\"" "$H" | head -20
echo
echo "=== ¿que espera como --run? ==="
grep -n -i 'capture\|run_dir\|args.run' "$H" | head -20
echo "CLI_OK"
