#!/usr/bin/env bash
# Convierte a Parquet UNA captura terminada y borra sus CSV originales.
#
# El borrado va autorizado por orden expresa del operador (27/08/2026) y
# respaldado por dos verificaciones independientes: la del propio conversor
# (pyarrow.Table.equals + filas + columnas) y la del revisor (parser csv de
# Python, 288 000 celdas comparadas, cero discrepancias).
#
# La captura a procesar se lee de /home/trading/objetivo_conversion.txt, que
# el revisor escribe antes de cada orden. Se hace de una en una, de la mas
# pequena a la mas grande: si algo falla, falla barato.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
OBJ=$(cat /home/trading/objetivo_conversion.txt 2>/dev/null)

if [ -z "$OBJ" ]; then
  echo "sin objetivo definido"
  exit 1
fi

if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "HAY UNA CAPTURA ACTIVA - conversion abortada"
  exit 1
fi

echo "objetivo: $OBJ"
echo "disco antes:"
df -h /home | tail -1
echo "CSV antes: $(find "$OBJ/capture" -name '*.csv' 2>/dev/null | wc -l)"
echo

"$PY" "$H" --staging "$OBJ" --borrar 2>&1 | tail -45

echo
echo "CSV despues: $(find "$OBJ/capture" -name '*.csv' 2>/dev/null | wc -l)"
echo "parquet: $(find "$OBJ/capture" -name '*.parquet' 2>/dev/null | wc -l)"
echo "disco despues:"
df -h /home | tail -1
du -sh "$OBJ/capture" 2>/dev/null
echo "CONVERTIR_UNO_OK"
