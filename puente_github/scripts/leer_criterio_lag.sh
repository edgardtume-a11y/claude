#!/usr/bin/env bash
# El codigo documenta una revision explicita del umbral del retraso del bucle.
# Hay que leer ese razonamiento antes de tratarlo como una grieta.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) la sonda: que mide exactamente ==="
sed -n '1412,1450p' "$SRC/collector.py"

echo
echo "=== B) donde se hace el rebase del libro ==="
grep -rn 'REBASE\|rebase' "$SRC/collector.py" | head -8

echo
echo "=== C) EL RAZONAMIENTO DEL AUTOR sobre el umbral (lo mas importante) ==="
sed -n '665,700p' "$SRC/audit.py"
echo "LEER_CRITERIO_OK"
