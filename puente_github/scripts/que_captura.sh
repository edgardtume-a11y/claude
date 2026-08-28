#!/usr/bin/env bash
# Hay una captura corriendo que no ordene yo. Antes que nada: QUE es, DESDE
# CUANDO, con QUE codigo, y si esta sana. Y a partir de ahora rige la regla
# "nada se toca mientras hay una captura activa".
set +e
echo "=== 1) el proceso, entero ==="
ps -eo pid,user,lstart,etime,%cpu,rss,cmd | grep -E 'dual_main' | grep -v grep

echo
echo "=== 2) ¿con que PYTHONPATH corre? (decide si captura liquidaciones y precio de marca) ==="
for p in $(pgrep -f 'binance_collector[.]dual_main'); do
  echo "  pid $p:"
  tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep -E '^PYTHONPATH=' | sed 's/^/    /'
  echo -n "    cwd: "; readlink /proc/$p/cwd 2>/dev/null
  echo -n "    linea: "; tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null; echo
done

echo
echo "=== 3) que staging esta escribiendo ==="
find /home/trading/jean-flow-exec/staging_runs -name '*.csv.partial' -newermt '-10 minutes' 2>/dev/null | head -5
echo "  --- el staging activo y su tamano ---"
for d in $(find /home/trading/jean-flow-exec/staging_runs -maxdepth 1 -type d -newermt '-3 hours' 2>/dev/null); do
  echo "  $d  $(du -sh "$d" 2>/dev/null | cut -f1)"
done

echo
echo "=== 4) ¿esta sana? ultimas metricas ==="
M=$(find /home/trading/jean-flow-exec/staging_runs -name 'jean_flow_metrics.jsonl' -newermt '-10 minutes' 2>/dev/null | head -1)
echo "  metricas: $M"
[ -n "$M" ] && tail -2 "$M" | cut -c1-400

echo
echo "=== 5) ¿llegan liquidaciones y precios de marca? ==="
[ -n "$M" ] && grep -o 'force_order_messages[^,]*' "$M" | tail -2
[ -n "$M" ] && grep -o 'mark_price_messages[^,]*' "$M" | tail -2

echo
echo "=== 6) ¿esta el rotador corriendo al lado? ==="
ps -eo pid,etime,cmd | grep -E 'rotador_parquet' | grep -v grep || echo "  NO hay rotador"

echo
echo "=== 7) disco y carga ==="; df -h /home | tail -1; cat /proc/loadavg
echo "=== 8) ¿quien entro? ==="; last -n 4 2>/dev/null | head -5; who
echo "QCAP_OK"
