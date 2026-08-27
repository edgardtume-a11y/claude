#!/usr/bin/env bash
# Solo lectura: bloque completo de validación del STOP en dual_main.py
F=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h/overlay/src/binance_collector/dual_main.py
sed -n '100,155p' "$F"
echo FORMATO2_OK
