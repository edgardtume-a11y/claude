#!/usr/bin/env bash
# ¿Se toco la instalacion base? Es lo unico irreversible del cambio.
# Se comprueba de dos formas independientes: por contenido y por fecha.
set +e
BASE=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
NUEVO=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*forceorder* 2>/dev/null | head -1)
GATE4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector

echo "=== 1) ¿la BASE menciona liquidaciones? (no deberia) ==="
grep -c 'force_order\|FORCE_ORDER\|forceOrder' "$BASE/collector.py" "$BASE/parquet_store.py" "$BASE/models.py" 2>/dev/null
echo "  (tres ceros = la base esta intacta)"

echo
echo "=== 2) fechas de modificacion de la base ==="
ls -la --time-style=+%Y-%m-%d_%H:%M "$BASE"/collector.py "$BASE"/parquet_store.py "$BASE"/models.py 2>/dev/null | awk '{print "  "$6" "$7}'
echo "  (si son de antes de hoy 08:32, nadie las toco)"

echo
echo "=== 3) que cambio EXACTAMENTE en el staging, respecto al gate 4 ==="
for f in collector.py parquet_store.py models.py audit.py dual_main.py; do
  if diff -q "$GATE4/$f" "$NUEVO/overlay/src/binance_collector/$f" >/dev/null 2>&1; then
    echo "  $f: SIN CAMBIOS"
  else
    n=$(diff "$GATE4/$f" "$NUEVO/overlay/src/binance_collector/$f" 2>/dev/null | grep -c '^[<>]')
    echo "  $f: $n lineas cambiadas"
  fi
done

echo
echo "=== 4) el diff de parquet_store (la lista cerrada) ==="
diff "$GATE4/parquet_store.py" "$NUEVO/overlay/src/binance_collector/parquet_store.py" 2>/dev/null | head -20

echo
echo "=== 5) el mapeo de columnas de la liquidacion ==="
grep -n -A22 'def force_order_batch' "$NUEVO/overlay/src/binance_collector/models.py" 2>/dev/null | head -30
echo "VERIFICAR_BASE_OK"
