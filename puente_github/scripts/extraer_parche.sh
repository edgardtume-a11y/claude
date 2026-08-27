#!/usr/bin/env bash
# Extrae el parche exacto de uvloop + gc.freeze para conservarlo en el repositorio.
# El staging es efimero; el cambio no debe morir con el.
set +e
G3=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
F=overlay/src/binance_collector/dual_main.py
echo "=== diff del gate 3 (sin mejoras) al gate 4 (con mejoras) ==="
diff -u "$G3/$F" "$G4/$F"
echo
echo "=== huellas ==="
sha256sum "$G3/$F" "$G4/$F"
echo "PARCHE_OK"
