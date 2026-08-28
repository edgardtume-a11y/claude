#!/usr/bin/env bash
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"

echo "=== A) el decodificador: ¿de donde sale cada dato? ==="
sed -n '255,300p' "$S/protocol.py"

echo
echo "=== B) la suscripcion en config.py ==="
sed -n '292,300p' "$S/config.py"; echo "  ---"; sed -n '338,348p' "$S/config.py"

echo
echo "=== C) las pruebas ==="
cd "$N" && PYTHONPATH=overlay/src timeout 90 "$PY" -m pytest overlay/tests -q 2>&1 | tail -12
echo "PRUEBAS_MP_OK"
