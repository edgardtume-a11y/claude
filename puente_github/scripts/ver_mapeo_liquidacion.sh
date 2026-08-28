#!/usr/bin/env bash
# El mapeo es lo que decide si el dato queda bien guardado. Si el precio va a
# la columna equivocada, la captura es correcta y los datos inservibles.
set +e
N=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*forceorder* 2>/dev/null | head -1)
S="$N/overlay/src/binance_collector"

echo "=== donde se define force_order_batch ==="
grep -rn 'def force_order_batch\|force_order_batch' "$S"/*.py | head -8

echo
echo "=== la funcion completa ==="
for f in "$S"/models.py "$S"/protocol.py "$S"/collector.py; do
  L=$(grep -n 'def force_order_batch' "$f" 2>/dev/null | head -1 | cut -d: -f1)
  if [ -n "$L" ]; then
    echo "--- en $(basename "$f") linea $L ---"
    sed -n "${L},$((L+40))p" "$f"
    break
  fi
done

echo
echo "=== como se decodifica el mensaje en collector.py ==="
L=$(grep -n 'force_order_messages' "$S/collector.py" | head -1 | cut -d: -f1)
[ -n "$L" ] && sed -n "$((L>25?L-25:1)),$((L+40))p" "$S/collector.py"
echo "MAPEO_OK"
