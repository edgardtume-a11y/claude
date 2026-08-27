#!/usr/bin/env bash
# PRUEBA EN SECO del conversor: sin --borrar, sobre la captura mas pequena
# que hay (48 MB). Si algo esta mal, se descubre aqui y no cuesta nada.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
CHICA=/home/trading/jean-flow-exec/staging_runs/20260826T052518Z_csv_persistence_hot_rebase_fix_10m

echo "=== antes ==="
du -sh "$CHICA/capture" 2>/dev/null
find "$CHICA/capture" -name '*.csv' | wc -l

echo
echo "=== ejecucion EN SECO (sin --borrar), limitada a 2 ficheros ==="
"$PY" "$H" --staging "$CHICA" --limite 2 2>&1 | tail -25

echo
echo "=== despues: los CSV DEBEN seguir ahi ==="
find "$CHICA/capture" -name '*.csv' | wc -l
find "$CHICA/capture" -name '*.parquet' -printf '%s %f\n' 2>/dev/null

echo
echo "=== manifiesto ==="
$PY -c "
import json,sys
try:
    d=json.load(open('$CHICA/parquet_manifiesto.json'))
    for k,v in list(d.items())[:3]:
        print(' ', v.get('filas'),'filas |', v.get('bytes_csv'),'->',v.get('bytes_parquet'),
              '| verificado:',v.get('verificado'),'| borrado:',v.get('csv_borrado'))
except Exception as e:
    print('  sin manifiesto:',e)
"
echo "SECO_OK"
