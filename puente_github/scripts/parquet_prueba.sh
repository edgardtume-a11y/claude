#!/usr/bin/env bash
# Etapa 1 de Parquet: instalar pyarrow en el venv del colector y probar
# ida-y-vuelta con datos reales del gate 1 (50k filas). Sin tocar originales.
set -e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
G1=/home/trading/jean-flow-exec/staging_runs/20260827T075205Z_tokyo_capture_gate1_30m
WORK=/home/trading/parquet_lab
mkdir -p "$WORK"

echo "=== 1/3 instalar pyarrow ==="
"$PY" -m pip install --quiet pyarrow
"$PY" -c "import pyarrow; print('pyarrow', pyarrow.__version__)"

echo "=== 2/3 muestra de 50k filas del gate 1 ==="
SRC=$(ls -S "$G1"/capture/*/*.csv "$G1"/capture/*.csv 2>/dev/null | head -1)
echo "fuente: $SRC"
head -50001 "$SRC" > "$WORK/muestra.csv"
wc -l "$WORK/muestra.csv"

echo "=== 3/3 CSV -> Parquet -> CSV + verificacion ==="
"$PY" - <<'PYEOF'
import hashlib
import pyarrow.csv as pc
import pyarrow.parquet as pq
import os
W = "/home/trading/parquet_lab"
# leer todo como texto para preservar los valores exactamente como estan
tabla = pc.read_csv(
    f"{W}/muestra.csv",
    convert_options=pc.ConvertOptions(column_types={}),
    read_options=pc.ReadOptions(),
)
pq.write_table(tabla, f"{W}/muestra.parquet", compression="zstd")
tabla2 = pq.read_table(f"{W}/muestra.parquet")
pc.write_csv(tabla2, f"{W}/muestra_vuelta.csv")
igual_tabla = tabla.equals(tabla2)
csv_b = os.path.getsize(f"{W}/muestra.csv")
pq_b = os.path.getsize(f"{W}/muestra.parquet")
print(f"tabla identica tras ida y vuelta: {igual_tabla}")
print(f"csv={csv_b} bytes  parquet={pq_b} bytes  compresion={csv_b/pq_b:.2f}x")
h1 = hashlib.sha256(open(f"{W}/muestra.csv","rb").read()).hexdigest()[:16]
print(f"hash muestra original: {h1}")
assert igual_tabla, "LA TABLA NO ES IDENTICA - PARQUET REPROBADO"
print("PARQUET_PRUEBA_OK")
PYEOF
