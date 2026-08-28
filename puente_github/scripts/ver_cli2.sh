#!/usr/bin/env bash
set +e
sed -n '155,205p' /home/trading/jean-flow-exec/herramientas/convertir_parquet.py
echo "--- ayuda real ---"
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python \
  /home/trading/jean-flow-exec/herramientas/convertir_parquet.py --help 2>&1 | head -30
echo "CLI2_OK"
