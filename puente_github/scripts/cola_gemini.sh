#!/usr/bin/env bash
set +e
echo "=== estado de los dos encargos ==="
for J in jfr-82c86db0d3b4f3589da579fe0a1bbdd3f5453c0d jfr-713eed782f1b08d3950d74d19af3f21978d3d6ae; do
  F=$(find /opt/jean-flow-gemini /var/lib/jean-flow-gemini /home/trading -maxdepth 4 -name "$J*" 2>/dev/null | head -3)
  echo "  $J:"; echo "$F" | sed 's/^/    /'
  for x in $F; do [ -f "$x" ] && python3 -c "
import json,sys
try:
  d=json.load(open('$x'))
  print('     status=',d.get('status'),'phase=',d.get('phase'),'upd=',d.get('updated_at'),'err=',str(d.get('error'))[:120])
except Exception as e: print('     (no json)')
"; done
done
echo
echo "=== donde guarda los trabajos ==="
ls -dt /opt/jean-flow-gemini/* /var/lib/jean-flow-gemini/* 2>/dev/null | head -10
find / -maxdepth 4 -type d -name '*gemini*jobs*' -o -maxdepth 4 -type d -name 'jobs' -path '*gemini*' 2>/dev/null | head -5
echo
echo "=== los ficheros de trabajo mas recientes ==="
find /opt/jean-flow-gemini /var/lib/jean-flow-gemini -name 'jfr-*' -newermt '-3 hours' 2>/dev/null | head -10
echo
echo "=== procesos ==="
ps -eo pid,etime,cmd | grep -iE 'gemini' | grep -v grep | sed 's/\(.\{150\}\).*/\1/'
echo "COLA_OK"
