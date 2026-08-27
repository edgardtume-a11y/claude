#!/usr/bin/env bash
set -e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
"$PY" -m pip install --quiet uvloop
"$PY" -c "import uvloop; print('uvloop', uvloop.__version__)"
echo UVLOOP_OK
