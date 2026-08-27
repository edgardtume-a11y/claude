#!/usr/bin/env bash
# LA PREGUNTA QUE DECIDE TODO:
# parquet_store solo convierte ficheros que terminan en .csv, y rechaza
# cualquier otro sufijo. Eso es seguro SOLO si el colector escribe primero a
# un nombre temporal (.csv.partial) y lo renombra al cerrar.
#
# Si el colector escribiera directamente a .csv, el conversor se pondria a leer
# el fichero que la captura tiene abierto. Hay que verificarlo, no suponerlo.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) ¿el writer usa .partial? ==="
grep -n 'partial\|\.csv\|rename\|os.replace\|suffix' "$SRC/writer.py" | head -20

echo
echo "=== B) donde se decide el nombre del fichero ==="
grep -n 'def _open\|def _rotate\|def _abrir\|_path\|Path(' "$SRC/writer.py" | head -15

echo
echo "=== C) el momento del cierre y renombrado ==="
L=$(grep -n 'os.replace\|\.rename(' "$SRC/writer.py" | head -1 | cut -d: -f1)
if [ -n "$L" ]; then
  sed -n "$((L>12?L-12:1)),$((L+6))p" "$SRC/writer.py"
else
  echo "NO HAY rename NI os.replace EN writer.py -- OJO"
fi

echo
echo "=== D) ¿quedaron .partial en las capturas ya terminadas? ==="
find /home/trading/jean-flow-exec/staging_runs -name '*.partial' 2>/dev/null | wc -l
echo "NOMBRES_OK"
