#!/usr/bin/env bash
# El cambio debe ser QUIRURGICO: solo como se leen las filas. Ningun umbral,
# ningun criterio, ninguna constante de certificacion.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*auditparquet* 2>/dev/null | head -1)
V=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"; W="$V/overlay/src/binance_collector"

echo "=== 1) ¿que ficheros cambiaron respecto al staging anterior? ==="
for f in audit.py collector.py normalize.py models.py protocol.py config.py parquet_store.py dual_main.py; do
  echo -n "  $f: "; diff -q "$W/$f" "$S/$f" >/dev/null 2>&1 && echo "identico" || { diff -u "$W/$f" "$S/$f" | grep -c '^[+-]' | tr -d '\n'; echo " lineas"; }
done

echo
echo "=== 2) LOS CRITERIOS DE CERTIFICACION: ¿intactos? ==="
for k in EVENT_LOOP_P99_LIMIT_MS METRICS_WARMUP_EXCLUSION_S _CAUSAL_RECORD_TYPES _REQUIRED_IDENTITY_MARKETS _MAX_REPORTED_CONFLICTS _MAX_REPORTED_GAP_RANGES; do
  a=$(grep -m1 "^$k" "$W/audit.py" 2>/dev/null); b=$(grep -m1 "^$k" "$S/audit.py" 2>/dev/null)
  [ "$a" = "$b" ] && echo "  $k: INTACTO" || { echo "  $k: ***CAMBIO***"; echo "    antes: $a"; echo "    ahora: $b"; }
done
echo -n "  _CAUSAL_RECORD_TYPES (contenido): "; grep -A2 '^_CAUSAL_RECORD_TYPES' "$S/audit.py" | tr -d '\n' | cut -c1-140; echo

echo
echo "=== 3) EL DIFF ENTERO de audit.py ==="
diff -u "$W/audit.py" "$S/audit.py" | head -120

echo
echo "=== 4) ¿compila y pasan las pruebas? ==="
"$PY" -m py_compile "$S/audit.py" && echo "  audit.py compila" || echo "  ***NO COMPILA***"
cd "$N" && PYTHONPATH=overlay/src timeout 80 "$PY" -m pytest overlay/tests -q 2>&1 | tail -8
echo "REV_AP_OK"
