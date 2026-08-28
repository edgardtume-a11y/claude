#!/usr/bin/env bash
set +e
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
echo "=== sitio 1: linea 318-345 ==="; sed -n '318,345p' "$B/audit.py"
echo; echo "=== sitio 2: linea 508,532 ==="; sed -n '508,532p' "$B/audit.py"
echo; echo "=== sitio 3: linea 782,800 ==="; sed -n '782,800p' "$B/audit.py"
echo; echo "=== el reconstructor probado (byte a byte) ==="
sed -n '1,80p' /home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py
echo "LEC_OK"
