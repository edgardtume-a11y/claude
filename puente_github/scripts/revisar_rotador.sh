#!/usr/bin/env bash
# REVISION del rotador escrito por Gemini. Este programa correra JUNTO A UNA
# CAPTURA EN VIVO y BORRA FICHEROS. Se revisa entero antes de dejarlo acercarse.
set +e
R=/home/trading/jean-flow-exec/herramientas/rotador_parquet.py
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

echo "=== 1) existe, es legible y compila ==="
ls -la "$R" 2>&1
"$PY" -m py_compile "$R" 2>&1 && echo COMPILA || echo "NO COMPILA"
echo "lineas: $(wc -l < "$R" 2>/dev/null)"

echo
echo "=== 2) las ocho salvaguardas ==="
chk() { if grep -q "$2" "$R" 2>/dev/null; then echo "  $1: PRESENTE"; else echo "  $1: ***AUSENTE***"; fi; }
chk "R1 respeta .csv.partial"        'partial'
chk "R2 verifica en esta ejecucion"  'verificar_segmento\|def verificar'
chk "R3 solo bajo capture/"          'capture'
chk "R3 usa realpath"                'realpath\|resolve()'
chk "R4 captura SegmentBusy"         'SegmentBusy'
chk "R4 captura ParquetStoreError"   'ParquetStoreError'
chk "R5 fichero de bloqueo"          'O_EXCL'
chk "R6 baja su prioridad"           'os.nice'
chk "R7 atiende SIGTERM"             'SIGTERM'
chk "R7 atiende SIGINT"              'SIGINT'
chk "R8 exige capture/"              'capture'
chk "usa parquet_store, no reimplementa" 'convert_available\|convert_segment'
chk "bandera --borrar"               'borrar'

echo
echo "=== 3) ¿reimplemento la conversion en vez de usar la que existe? ==="
grep -c 'pq.write_table\|write_table' "$R" 2>/dev/null
echo "(debe ser 0: la conversion la hace parquet_store)"

echo
echo "=== 4) TODOS los sitios donde borra ==="
grep -n 'os.remove\|os.unlink\|\.unlink(' "$R" 2>/dev/null

echo
echo "=== 5) el bloque de borrado, literal, con 15 lineas antes ==="
for N in $(grep -n 'os.remove\|\.unlink(' "$R" 2>/dev/null | cut -d: -f1); do
  echo "  ##### linea $N"
  sed -n "$((N>15?N-15:1)),${N}p" "$R" | sed 's/^/     /'
done

echo
echo "=== 6) ¿borra por defecto? (la respuesta debe ser NO) ==="
grep -n -A3 '\-\-borrar' "$R" 2>/dev/null | head -8
echo "REVISAR_ROTADOR_OK"
