#!/usr/bin/env bash
# PRIMERA EJECUCION EN LA HISTORIA de parquet_store.py.
#
# 641 lineas escritas por el autor original que nadie ha corrido nunca. Antes de
# ponerlo en el camino de los datos de una captura de 7 dias, hay que verlo
# funcionar con datos reales.
#
# Como ya no quedan CSV (se convirtieron todos esta noche), se reconstruye uno
# desde su Parquet y se le da a parquet_store. Si su Parquet coincide con el que
# ya teniamos, el modulo hace lo que dice.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
SRCROOT=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src
REC=/home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py
BASE=/home/trading/jean-flow-exec/staging_runs
LAB=$BASE/lab_parquet_store

echo "=== 0) preparar laboratorio ==="
rm -rf "$LAB"
mkdir -p "$LAB/capture/spot" "$LAB/parquet" "$LAB/manifiestos"

# el parquet mas pequeno que haya, para que la prueba sea rapida
P=$(find "$BASE" -name '*.parquet' -printf '%s %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2)
echo "parquet de partida: $(basename "$P")  ($(stat -c%s "$P") bytes)"

echo
echo "=== 1) reconstruir un CSV real desde ese parquet ==="
"$PY" "$REC" --parquet "$P" --destino "$LAB/capture/spot/segmento.csv" 2>&1 | tail -5
ls -la "$LAB/capture/spot/"

echo
echo "=== 2) EJECUTAR parquet_store por primera vez ==="
PYTHONPATH="$SRCROOT" "$PY" -m binance_collector.parquet_store \
  --source-root "$LAB/capture" \
  --parquet-root "$LAB/parquet" \
  --manifest-root "$LAB/manifiestos" \
  --max-files 1 2>&1 | head -20
echo "codigo de retorno: ${PIPESTATUS[0]}"

echo
echo "=== 3) ¿que dejo? ==="
find "$LAB/parquet" "$LAB/manifiestos" -type f -printf '%s\t%p\n' 2>/dev/null

echo
echo "=== 4) ¿su parquet coincide con el original? ==="
NUEVO=$(find "$LAB/parquet" -name '*.parquet' | head -1)
if [ -n "$NUEVO" ]; then
  "$PY" - "$P" "$NUEVO" <<'PYEOF'
import sys
import pyarrow.parquet as pq
a = pq.read_table(sys.argv[1])
b = pq.read_table(sys.argv[2])
print(f"  original: {a.num_rows} filas, {len(a.column_names)} columnas")
print(f"  nuevo   : {b.num_rows} filas, {len(b.column_names)} columnas")
print(f"  mismas filas   : {a.num_rows == b.num_rows}")
print(f"  mismas columnas: {a.column_names == b.column_names}")
# los tipos pueden diferir: parquet_store escribe enteros donde el conversor
# de esta noche guardo texto. Se comparan los valores como texto.
if a.num_rows == b.num_rows and a.column_names == b.column_names:
    difs = 0
    for c in a.column_names:
        ca = [("" if v is None else str(v)) for v in a.column(c).to_pylist()]
        cb = [("" if v is None else str(v)) for v in b.column(c).to_pylist()]
        if ca != cb:
            difs += 1
            i = next(k for k in range(len(ca)) if ca[k] != cb[k])
            print(f"  columna '{c}' difiere; fila {i}: {ca[i]!r} vs {cb[i]!r}")
    print(f"  columnas con diferencias: {difs}/{len(a.column_names)}")
PYEOF
else
  echo "  NO GENERO NINGUN PARQUET"
fi

echo
echo "=== 5) el manifiesto que escribio ==="
M=$(find "$LAB/manifiestos" -type f | head -1)
[ -n "$M" ] && head -c 1200 "$M"

echo
echo "PROBAR_PS_OK"
