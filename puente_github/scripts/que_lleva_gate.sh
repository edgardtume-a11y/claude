#!/usr/bin/env bash
# SOLO LECTURA. Hay una captura activa: no se toca nada.
# La pregunta: ¿el overlay con el que corre lleva liquidaciones y precio de marca?
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
S="$N/overlay/src/binance_collector"
echo "=== ¿que lleva el overlay que esta corriendo? ==="
echo -n "  force_order en normalize.py : "; grep -c 'force_order_batch' "$S/normalize.py" 2>/dev/null
echo -n "  mark_price  en normalize.py : "; grep -c 'mark_price_batch' "$S/normalize.py" 2>/dev/null
echo -n "  FORCE_ORDER en parquet_store: "; grep -c 'FORCE_ORDER' "$S/parquet_store.py" 2>/dev/null
echo -n "  MARK_PRICE  en parquet_store: "; grep -c 'MARK_PRICE' "$S/parquet_store.py" 2>/dev/null
echo -n "  @forceOrder en config.py    : "; grep -c 'forceOrder' "$S/config.py" 2>/dev/null
echo -n "  @markPrice  en config.py    : "; grep -c 'markPrice' "$S/config.py" 2>/dev/null
echo -n "  auditor lee parquet         : "; grep -ci 'parquet' "$S/audit.py" 2>/dev/null

echo
echo "=== ¿de donde salio este staging? ==="
ls -ld "$N"; ls -l "$N/control/" 2>/dev/null | head -8
echo "  --- session.json ---"; head -c 700 "$N/control/session.json" 2>/dev/null; echo
echo "  --- ¿hay notas de quien lo creo? ---"
ls -l "$N" 2>/dev/null

echo
echo "=== cuanto lleva y cuanto escribe ==="
echo -n "  arrancada: "; stat -c '%y' "$N/control/session.json" 2>/dev/null | cut -c1-19
echo -n "  ahora    : "; date -u +'%Y-%m-%d %H:%M:%S'
du -sh "$N/capture" 2>/dev/null
echo -n "  ficheros cerrados: "; find "$N/capture" -name '*.csv' | wc -l
echo -n "  en escritura     : "; find "$N/capture" -name '*.csv.partial' | wc -l

echo
echo "=== ¿hay contadores de los flujos nuevos en las metricas? ==="
M="$N/capture/jean_flow_metrics.jsonl"
for c in force_order_messages mark_price_messages agg_trade_messages; do
  echo -n "  $c: "; grep -o "\"$c\":[0-9]*" "$M" 2>/dev/null | tail -1 || echo "(ninguno)"
done
echo "QLG_OK"
