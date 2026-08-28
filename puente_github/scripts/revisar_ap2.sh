#!/usr/bin/env bash
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
V=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"; W="$V/overlay/src/binance_collector"

echo "=== 1) ¿que ficheros cambiaron? (solo audit.py deberia) ==="
for f in audit.py collector.py normalize.py models.py protocol.py config.py parquet_store.py dual_main.py; do
  echo -n "  $f: "; diff -q "$W/$f" "$S/$f" >/dev/null 2>&1 && echo "identico" || { diff -u "$W/$f" "$S/$f" | grep -c '^[+-]' | tr -d '\n'; echo " lineas"; }
done

echo
echo "=== 2) LOS CRITERIOS: ¿intactos? ==="
for k in EVENT_LOOP_P99_LIMIT_MS METRICS_WARMUP_EXCLUSION_S _MAX_REPORTED_CONFLICTS _MAX_REPORTED_GAP_RANGES; do
  a=$(grep -m1 "^$k" "$W/audit.py"); b=$(grep -m1 "^$k" "$S/audit.py")
  [ "$a" = "$b" ] && echo "  $k: INTACTO ($b)" || { echo "  $k: ***CAMBIO*** antes[$a] ahora[$b]"; }
done
for k in _CAUSAL_RECORD_TYPES _REQUIRED_IDENTITY_MARKETS _IDENTITY_COLUMNS; do
  a=$(grep -A4 "^$k" "$W/audit.py" | tr -d ' \n'); b=$(grep -A4 "^$k" "$S/audit.py" | tr -d ' \n')
  [ "$a" = "$b" ] && echo "  $k: INTACTO" || echo "  $k: ***CAMBIO***"
done

echo
echo "=== 3) el helper nuevo, entero ==="
grep -n -A38 'def _iterar_filas' "$S/audit.py" | head -45

echo
echo "=== 4) ¿solo cambio la lectura? lineas del diff que NO son de lectura ==="
diff -u "$W/audit.py" "$S/audit.py" | grep '^[+-]' | grep -v '^[+-][+-]' \
  | grep -viE 'open\(|DictReader|parquet|pyarrow|_iterar_filas|fieldnames|handle|reader|yield|import|def |"""|#|^\+\s*$|^\-\s*$' | head -25
echo "  (arriba: lo que cambio y no es lectura. Cuanto mas corto, mejor)"

echo
echo "=== 5) pruebas ==="
cd "$N" && PYTHONPATH=overlay/src timeout 80 "$PY" -m pytest overlay/tests -q 2>&1 | tail -8
echo "REV_AP2_OK"
