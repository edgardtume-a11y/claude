#!/usr/bin/env bash
# Proyeccion de volumen para los gates largos (6h / 24h / 7 dias) y espacio real.
set +e
G3=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
echo "=== 1) disco real ==="
df -h / /home 2>&1
echo
echo "=== 2) todos los staging_runs ==="
du -sh /home/trading/jean-flow-exec/staging_runs/* 2>/dev/null | sort -h
echo
echo "=== 3) total ocupado por capturas ==="
du -sh /home/trading/jean-flow-exec/staging_runs 2>/dev/null
echo
echo "=== 4) duracion real y tasa del gate 3 ==="
python3 - <<'PY'
import os, glob, datetime
G3="/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h"
fs=glob.glob(os.path.join(G3,"capture","**","*.csv"), recursive=True)
tot=sum(os.path.getsize(f) for f in fs)
mt=[os.path.getmtime(f) for f in fs]
ct=[os.path.getctime(f) for f in fs]
dur=(max(mt)-min(ct))/3600.0
print(f"ficheros CSV: {len(fs)}")
print(f"bytes totales: {tot} ({tot/2**30:.2f} GiB)")
print(f"duracion aprox: {dur:.2f} h")
if dur>0:
    tasa=tot/2**30/dur
    print(f"tasa: {tasa:.2f} GiB/h")
    for h,nom in ((6,'gate 6h'),(24,'gate 24h'),(168,'7 dias')):
        print(f"  {nom:10s}: {tasa*h:8.1f} GiB  |  con parquet 71.9x: {tasa*h/71.93:6.2f} GiB")
PY
echo
echo "=== 5) journal_usdm todavia corriendo? ==="
ls -la "$G3/audit/" 2>&1 | grep -E 'journal_usdm|return_codes|metrics|identity'
pgrep -fc 'binance_collector.audit' 2>&1
echo "PROYECCION_OK"
