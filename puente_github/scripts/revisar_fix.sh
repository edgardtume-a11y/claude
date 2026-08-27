#!/usr/bin/env bash
# ¿Bajo que condicion entra el bloque nuevo de reverificacion y borrado?
# Lo que protege los datos no es el comentario: es el if que lo envuelve.
set +e
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

echo "=== compila? ==="
"$PY" -m py_compile "$H" && echo COMPILA || echo "NO COMPILA"
echo "lineas: $(wc -l < "$H")"

echo
echo "=== el bloque de idempotencia y su nueva rama, literal ==="
L=$(grep -n 'registro_previo' "$H" | head -1 | cut -d: -f1)
sed -n "$((L-6)),$((L+22))p" "$H" | cat -n | sed 's/^/  /'

echo
echo "=== todos los sitios donde se borra un CSV ==="
grep -n 'os.remove(ruta_csv)' "$H"
echo "--- cada uno con sus 12 lineas previas ---"
for N in $(grep -n 'os.remove(ruta_csv)' "$H" | cut -d: -f1); do
  echo "  ##### linea $N"
  sed -n "$((N-12)),${N}p" "$H" | sed 's/^/     /'
done
echo "REVISAR_FIX_OK"
