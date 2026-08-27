#!/usr/bin/env bash
# Radiografía del código del proyecto (solo lectura, liviano; seguro con captura activa).
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector
echo "=== TAMAÑO DEL PROYECTO ==="
find "$SRC/src" -name '*.py' 2>/dev/null | wc -l
find "$SRC/src" -name '*.py' -exec cat {} + 2>/dev/null | wc -l
echo "=== MODULOS PRINCIPALES (lineas) ==="
find "$SRC/src" -name '*.py' -exec wc -l {} + 2>/dev/null | sort -rn | head -12
echo "=== PRUEBAS ==="
find "$SRC" -path '*/tests/*' -name 'test_*.py' 2>/dev/null | wc -l
echo "=== DEPENDENCIAS INSTALADAS ==="
"$SRC/.venv/bin/pip" list 2>/dev/null | head -25
echo "=== TIPADO / CALIDAD (presencia) ==="
grep -rl 'from typing\|: int\|-> None' "$SRC/src" 2>/dev/null | wc -l
ls "$SRC" | head -20
echo AUDIT_OK
