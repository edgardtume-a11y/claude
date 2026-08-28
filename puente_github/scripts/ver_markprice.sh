#!/usr/bin/env bash
set +e
RUNS=/home/trading/jean-flow-exec/staging_runs
N=$(ls -dt "$RUNS"/*markprice* 2>/dev/null | head -1)
if [ -z "$N" ]; then echo "TODAVIA NO HAY STAGING markprice"; ls -dt "$RUNS"/* | head -3; exit 0; fi
echo "staging: $N"; ls -ld "$N"
S="$N/overlay/src/binance_collector"
echo "--- ¿toco la base? (deben ser 0,0,0) ---"
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
for f in collector.py parquet_store.py normalize.py; do echo -n "  base/$f: "; grep -c -i 'mark_price\|markPrice' "$B/$f" 2>/dev/null; done
echo "--- listas cerradas del overlay ---"
grep -n -A12 '_SEQUENCED_RECORD_TYPES\s*=' "$S/parquet_store.py" 2>/dev/null | head -14
echo "--- MARK_PRICE en normalize/collector ---"
grep -n -c 'MARK_PRICE\|mark_price\|markPrice' "$S/normalize.py" "$S/collector.py" "$S/models.py" 2>/dev/null
echo "--- ficheros nuevos ---"; ls -l "$N/overlay/tests/" 2>/dev/null | tail -8
echo "MP_OK"
