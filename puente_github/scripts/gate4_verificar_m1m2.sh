#!/usr/bin/env bash
# ¿Cuanto de M1 y M2 ya existe realmente? Salida corta y ordenada:
# lo mas importante al final, porque el puente solo devuelve los ultimos 4000 caracteres.
set +e
SRC=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector

echo "=== M2: naturaleza del writer (hilo o tarea asyncio) ==="
grep -n 'class .*Writer\|threading.Thread\|async def\|await ' "$SRC/writer.py" | head -12
echo "--- valor por defecto del troceado ---"
grep -n 'write_chunk_rows' "$SRC/writer.py"

echo
echo "=== M1: low_latency_runtime completo ==="
sed -n '225,265p' "$SRC/latency.py"
echo "--- ¿existe gc.freeze en todo el paquete? ---"
grep -rn 'gc.freeze' "$SRC/" || echo "NO EXISTE gc.freeze EN NINGUN MODULO"
echo "VERIFICAR_OK"
