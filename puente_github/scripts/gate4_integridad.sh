#!/usr/bin/env bash
# ¿Dejó Gemini los ficheros del gate 4 a medias tras su timeout?
# Compara contra el gate 3, que es la fuente intacta de la que se copió.
set +e
G3=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

echo "=== 1) huellas de los dos ficheros autorizados ==="
for f in dual_main.py writer.py; do
  a=$(sha256sum "$G3/overlay/src/binance_collector/$f" 2>/dev/null | cut -c1-16)
  b=$(sha256sum "$G4/overlay/src/binance_collector/$f" 2>/dev/null | cut -c1-16)
  na=$(wc -l < "$G3/overlay/src/binance_collector/$f" 2>/dev/null)
  nb=$(wc -l < "$G4/overlay/src/binance_collector/$f" 2>/dev/null)
  if [ "$a" = "$b" ]; then est="INTACTO"; else est="MODIFICADO"; fi
  echo "$f: gate3=$a ($na lineas)  gate4=$b ($nb lineas)  -> $est"
done

echo
echo "=== 2) ¿el gate 4 compila? ==="
for f in dual_main.py writer.py; do
  "$PY" -m py_compile "$G4/overlay/src/binance_collector/$f" 2>&1 \
    && echo "$f: COMPILA" || echo "$f: NO COMPILA"
done

echo
echo "=== 3) rastro de las mejoras en el gate 4 ==="
grep -n 'set_threshold\|gc.freeze\|gc.disable\|uvloop\|sched_setaffinity' \
  "$G4/overlay/src/binance_collector/dual_main.py" 2>/dev/null | head -20 \
  || echo "(sin rastro de M1/M3 en dual_main.py)"
grep -n 'asyncio.sleep(0)\|CHUNK\|chunk' \
  "$G4/overlay/src/binance_collector/writer.py" 2>/dev/null | head -20 \
  || echo "(sin rastro de M2 en writer.py)"

echo
echo "=== 4) ficheros tocados en el gate 4 en la ultima hora ==="
find "$G4" -type f -mmin -75 -printf '%TH:%TM %p\n' 2>/dev/null | sort | head -20

echo
echo "=== 5) auditoria usdm del gate 3 ==="
ls -la "$G3/audit/" 2>&1 | tail -12
pgrep -fc 'binance_collector.audit'
echo "INTEGRIDAD_OK"
