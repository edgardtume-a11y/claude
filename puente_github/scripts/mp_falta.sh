#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"
echo "=== ¿vive el encargo? ==="
ps -eo pid,etime,cmd | grep 'gemini_job_runner' | grep -v grep | sed 's/\(.\{140\}\).*/\1/' || echo "  MUERTO"
echo
echo "=== ¿se SUSCRIBE al flujo? (sin esto no llega ni un dato) ==="
grep -n 'markPrice\|markPriceUpdate' "$S"/*.py | grep -v 'mark_price_batch' | head -20
echo
echo "=== ¿se DECODIFICA el mensaje markPriceUpdate? ==="
grep -rn 'markPriceUpdate' "$S" | head -10
echo
echo "=== estado de lo que falta ==="
echo -n "  MARK_PRICE en parquet_store: "; grep -c 'MARK_PRICE' "$S/parquet_store.py"
echo -n "  FORCE_ORDER en parquet_store: "; grep -c 'FORCE_ORDER' "$S/parquet_store.py"
echo -n "  test_markprice.py: "; [ -f "$N/overlay/tests/test_markprice.py" ] && echo SI || echo NO
echo
echo "=== fechas ==="; date -u +'  ahora %H:%M:%S'
for f in normalize.py collector.py models.py parquet_store.py; do echo -n "  $f "; stat -c '%y' "$S/$f" | cut -c12-19; done
echo "FALTA_OK"
