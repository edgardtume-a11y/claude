#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"
echo "=== ¿el trabajo sigue vivo? ==="
ps -eo pid,etime,cmd | grep -iE 'gemini|jfr-' | grep -v grep | head -5 || echo "  ningun proceso gemini"
echo
echo "=== fechas de lo tocado (¿avanza o esta parado?) ==="
date -u +'  ahora: %H:%M:%S'
for f in normalize.py collector.py models.py parquet_store.py audit.py; do
  echo -n "  $f: "; stat -c '%y' "$S/$f" 2>/dev/null | cut -c1-19
done
ls -l "$N/overlay/tests/" 2>/dev/null | grep -i mark || echo "  test_markprice.py: NO EXISTE"
echo
echo "=== ¿esta MARK_PRICE en parquet_store del overlay? ==="
grep -n 'MARK_PRICE' "$S/parquet_store.py" 2>/dev/null || echo "  NO ESTA -> la conversion a Parquet fallaria"
echo
echo "=== lo que SI escribio en normalize.py ==="
grep -n -B2 -A22 'MARK_PRICE\|mark_price_batch' "$S/normalize.py" 2>/dev/null | head -45
echo
echo "=== y en collector.py ==="
grep -n -B3 -A6 'MARK_PRICE\|markPrice\|mark_price' "$S/collector.py" 2>/dev/null | head -30
echo
echo "=== y en models.py ==="
grep -n -B3 -A14 'MarkPrice\|mark_price\|markPrice' "$S/models.py" 2>/dev/null | head -35
echo "EST_OK"
