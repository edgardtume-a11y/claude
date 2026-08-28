#!/usr/bin/env bash
# Dos preguntas que deciden si el cambio sirve o falla en produccion:
#
# 1. ¿Que ficheros hay en cada overlay? Si el overlay solo sombrea algunos
#    modulos, el resto se importa de la instalacion base.
#
# 2. Y sobre todo: cuando el ROTADOR corra durante la captura, ¿que
#    parquet_store importara? Si importa el de la base -que NO tiene
#    FORCE_ORDER- la conversion fallara en cuanto llegue una liquidacion.
#    El arreglo estaria en el overlay y el fallo en produccion.
set +e
NUEVO=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*forceorder* 2>/dev/null | head -1)
GATE4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
BASE=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== 1) ficheros en el overlay del gate 4 ==="
ls -1 "$GATE4/overlay/src/binance_collector/"*.py 2>/dev/null | xargs -n1 basename | tr '\n' ' '
echo
echo "=== 2) ficheros en el overlay NUEVO (forceorder) ==="
ls -1 "$NUEVO/overlay/src/binance_collector/"*.py 2>/dev/null | xargs -n1 basename | tr '\n' ' '
echo
echo "=== 3) ficheros en la instalacion BASE ==="
ls -1 "$BASE"/*.py 2>/dev/null | xargs -n1 basename | tr '\n' ' '
echo

echo
echo "=== 4) LA PREGUNTA CLAVE: FORCE_ORDER, ¿donde esta y donde no? ==="
for p in "$BASE/parquet_store.py" "$GATE4/overlay/src/binance_collector/parquet_store.py" "$NUEVO/overlay/src/binance_collector/parquet_store.py"; do
  if [ -f "$p" ]; then
    n=$(grep -c 'FORCE_ORDER' "$p")
    echo "  $n ocurrencias en ${p#/home/trading/}"
  else
    echo "  (no existe) ${p#/home/trading/}"
  fi
done

echo
echo "=== 5) el mapeo de la liquidacion a columnas ==="
grep -n 'force_order' "$NUEVO/overlay/src/binance_collector/models.py" | head -5
L=$(grep -n 'def force_order_batch' "$NUEVO/overlay/src/binance_collector/models.py" | head -1 | cut -d: -f1)
[ -n "$L" ] && sed -n "${L},$((L+30))p" "$NUEVO/overlay/src/binance_collector/models.py"

echo
echo "=== 6) como lanza el gate: ¿que PYTHONPATH usa? ==="
grep -n 'PYTHONPATH' "$NUEVO/control/launch_live.sh" 2>/dev/null | head -3
grep -n 'PYTHONPATH' "$GATE4/control/launch_live.sh" 2>/dev/null | head -3
echo "HUECO_OK"
