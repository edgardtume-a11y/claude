#!/usr/bin/env bash
# Lectura del codigo real antes de redactar los contratos partidos para Gemini.
set +e
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
SRC=$G4/overlay/src/binance_collector

echo "=== A) writer.py 250-320 (el bucle de escritura, para M2) ==="
sed -n '250,320p' "$SRC/writer.py"

echo
echo "=== B) writer.py: donde se decide write_chunk_rows ==="
sed -n '30,65p' "$SRC/writer.py"

echo
echo "=== C) dual_main.py: importaciones y arranque (para M1 y M3) ==="
sed -n '1,45p' "$SRC/dual_main.py"

echo
echo "=== D) dual_main.py: el punto de entrada / asyncio.run ==="
grep -n 'asyncio.run\|def main\|__main__\|new_event_loop\|set_event_loop' "$SRC/dual_main.py"

echo
echo "=== E) dual_main.py: 30 lineas alrededor del asyncio.run ==="
L=$(grep -n 'asyncio.run' "$SRC/dual_main.py" | head -1 | cut -d: -f1)
[ -n "$L" ] && sed -n "$((L>20?L-20:1)),$((L+15))p" "$SRC/dual_main.py"

echo
echo "=== F) ¿ya se toca el recolector de basura en algun sitio? ==="
grep -rn 'import gc\|gc\.' "$SRC/"*.py | head -20

echo "LEER_CODIGO_OK"
