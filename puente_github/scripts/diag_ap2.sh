#!/usr/bin/env bash
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
P=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/capture/spot/events-20260827T203002.737505Z-000001.parquet
echo "=== la traza de verdad ==="
PYTHONPATH="$N/overlay/src" "$PY" - <<PYCODE
import traceback
from pathlib import Path
from binance_collector.audit import audit_journal
try:
    r = audit_journal([Path("$P")])
    print("  OK ->", r.get("certification"))
except Exception:
    traceback.print_exc()
PYCODE
echo
echo "=== otras lecturas: incomplete_markers y modulos importados ==="
S="$N/overlay/src/binance_collector"
grep -n 'incomplete_markers\|_related_partial_files\|^from \.\|^import \|^from binance' "$S/audit.py" | head -25
echo "DIAG2_OK"
