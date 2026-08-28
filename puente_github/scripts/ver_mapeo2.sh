#!/usr/bin/env bash
set +e
N=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*forceorder* 2>/dev/null | head -1)
S="$N/overlay/src/binance_collector"
echo "=== force_order_batch en normalize.py ==="
sed -n '164,215p' "$S/normalize.py"
echo
echo "=== ForceOrderEvent: que campos guarda ==="
grep -n -A18 'class ForceOrderEvent' "$S/protocol.py" 2>/dev/null | head -24
echo "MAPEO2_OK"
