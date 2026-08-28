#!/usr/bin/env bash
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
V=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"; W="$V/overlay/src/binance_collector"

echo "=== ficheros cambiados (solo audit.py y reconstruct.py) ==="
for f in audit.py reconstruct.py collector.py normalize.py models.py protocol.py config.py parquet_store.py dual_main.py identity.py metrics.py; do
  echo -n "  $f: "; diff -q "$W/$f" "$S/$f" >/dev/null 2>&1 && echo "identico" || { diff -u "$W/$f" "$S/$f" 2>/dev/null | grep -c '^[+-]' | tr -d '\n'; echo " lineas"; }
done

echo
echo "=== ¿la BASE intacta? (todo 0) ==="
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
for f in audit.py reconstruct.py; do echo -n "  base/$f parquet: "; grep -ci 'parquet' "$B/$f"; done

echo
echo "=== criterios intactos ==="
for k in EVENT_LOOP_P99_LIMIT_MS METRICS_WARMUP_EXCLUSION_S _MAX_REPORTED_CONFLICTS _MAX_REPORTED_GAP_RANGES; do
  a=$(grep -m1 "^$k" "$W/audit.py"); b=$(grep -m1 "^$k" "$S/audit.py")
  [ "$a" = "$b" ] && echo "  $k: INTACTO" || echo "  $k: ***CAMBIO***"
done
for k in _CAUSAL_RECORD_TYPES _REQUIRED_IDENTITY_MARKETS _IDENTITY_COLUMNS; do
  a=$(grep -A4 "^$k" "$W/audit.py" | tr -d ' \n'); b=$(grep -A4 "^$k" "$S/audit.py" | tr -d ' \n')
  [ "$a" = "$b" ] && echo "  $k: INTACTO" || echo "  $k: ***CAMBIO***"
done

echo
echo "=== el apreton de manos .csv.partial: ¿conservado? ==="
grep -n 'csv.partial' "$S/audit.py" "$S/reconstruct.py" | head -8

echo
echo "=== pruebas ==="
cd "$N" && PYTHONPATH=overlay/src timeout 80 "$PY" -m pytest overlay/tests -q 2>&1 | tail -6
echo "RFA_OK"
