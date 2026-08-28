#!/usr/bin/env bash
# El chequeo dice capturas_activas=1 y el disco ha liberado 13 GB. Ninguna de
# las dos cosas las he hecho yo. Antes de alarmar: ¿QUE es exactamente?
set +e
echo "=== 1) que procesos hay ==="
ps -eo pid,user,etime,%cpu,rss,cmd | grep -iE 'dual_main|binance_collector|python' | grep -v grep | sed 's/\(.\{160\}\).*/\1/'

echo
echo "=== 2) ¿como cuenta el guardian las capturas? ==="
grep -n -B4 -A10 'capturas_activas' /home/trading/puente_github_watcher.py | head -25

echo
echo "=== 3) ¿hay una captura DE VERDAD escribiendo? ==="
find /home/trading/jean-flow-exec/staging_runs -name '*.csv.partial' -newermt '-30 minutes' 2>/dev/null | head -5
echo "  ficheros modificados en staging_runs en los ultimos 15 min:"
find /home/trading/jean-flow-exec/staging_runs -type f -newermt '-15 minutes' 2>/dev/null | head -10

echo
echo "=== 4) el disco: ¿que se fue? ==="
df -h /home | tail -1
du -sh /home/trading/banco_auditparquet 2>/dev/null || echo "  banco_auditparquet: ya no existe"
du -sh /home/trading/respaldo_24_27 /home/trading/restore_stage_20260825 /home/trading/jean-flow-exec/staging_runs 2>/dev/null
ls -l /home/trading/*.zip 2>/dev/null | head -5

echo
echo "=== 5) ¿quien ha entrado? ==="
last -n 8 2>/dev/null | head -10
echo "  sesiones abiertas:"; who 2>/dev/null
echo "QC_OK"
