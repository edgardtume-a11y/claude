#!/usr/bin/env bash
# LA PRUEBA QUE DECIDE: auditar un Parquet del gate 4 y exigir codigo 0
# con causal_replay PASS. Si esto sale, la opcion B esta demostrada.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
G=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
export PYTHONPATH="$N/overlay/src"
O=/home/trading/banco_auditparquet/informes; mkdir -p "$O"

echo "=== journal sobre el PARQUET de spot ==="
timeout 100 "$PY" -m binance_collector.audit journal "$G"/capture/spot/*.parquet > "$O/pq_journal_spot.json" 2> "$O/pq_journal_spot.err"
echo "  rc=$?"
tail -3 "$O/pq_journal_spot.err"
"$PY" -c "
import json
try:
    d=json.load(open('$O/pq_journal_spot.json'))
    c=d.get('certification',{})
    print('  causal_replay :', c.get('causal_replay'))
    print('  journal_integ :', c.get('journal_integrity'))
    print('  sha256 libro  :', (d.get('replay') or {}).get('sha256'))
    print('  DEBE SER      : 1d749fd5d6c741b1d9cba0bdc9f2668fbe796baa7bff5af1113b2e0dc9f36c00')
except Exception as e: print('  sin informe:', e)"
echo "PC_OK"
