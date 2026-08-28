#!/usr/bin/env bash
# ANTES DE DECIR "EMPEORO": ¿el numero significa lo mismo?
# gate4 midio event_loop_lag = 3.0 ms. postmask mide 22.385 ms. Pero el diff
# dice "el SLI legacy de abajo usa EXCLUSIVAMENTE perf_counter_ns", lo que
# sugiere que ANTES se medía con loop.time() y AHORA con perf_counter_ns.
# loop.time() no ve el retraso del despertar del planificador; perf_counter_ns si.
# Si la definicion cambio, comparar 3.0 con 22.4 es comparar dos cosas distintas
# — el mismo error que cometi con los 19 ms.
set +e
P=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/overlay/src/binance_collector
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector

echo "=== COMO medía gate4 el event_loop_lag ==="
grep -n -B6 -A14 'event_loop_lag' "$G4/collector.py" | head -40

echo
echo "=== COMO lo mide postmask ==="
grep -n -B4 -A10 '"event_loop_lag"' "$P/collector.py" | head -30

echo
echo "=== ¿cambio metrics.py en como se calcula? (265 lineas de diff) ==="
diff -u "$G4/metrics.py" "$P/metrics.py" | grep -E '^[+-]' | grep -viE '^[+-][+-]' | grep -iE 'event_loop|lag|percentil|p99|window|ventana|clock|perf_counter|monotonic' | head -25

echo
echo "=== ¿y audit.py? (285 lineas) ¿cambio el umbral o la base? ==="
for k in EVENT_LOOP_P99_LIMIT_MS METRICS_WARMUP_EXCLUSION_S; do
  echo "  $k:"; echo -n "    gate4   : "; grep -m1 "^$k" "$G4/audit.py"
  echo -n "    postmask: "; grep -m1 "^$k" "$P/audit.py"
done
echo "  --- metricas nuevas que audit.py exige en postmask y no en gate4 ---"
diff -u "$G4/audit.py" "$P/audit.py" | grep '^+' | grep -oE '"[a-z_]*lag[a-z_]*"|"[a-z_]*p99[a-z_]*"' | sort -u | head -15
echo "MLM_OK"
