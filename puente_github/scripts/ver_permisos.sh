#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
ls -l "$N/overlay/tests/" 2>/dev/null | head -8
echo -n "  audit.py: "; ls -l "$N/overlay/src/binance_collector/audit.py" | awk '{print $1,$3,$4}'
echo "PERM_OK"
