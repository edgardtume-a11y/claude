#!/usr/bin/env bash
# Para la prueba de informes identicos hace falta el gate 4 con:
#  - sus informes certificados (la verdad)
#  - sus CSV o, si ya no estan, sus Parquet
set +e
G=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
echo "=== informes certificados ==="
ls -l "$G/audit/" 2>/dev/null | head -15
echo -n "  codigos de retorno: "; cat "$G/audit/return_codes.json" 2>/dev/null

echo
echo "=== que hay en capture/ ==="
for m in spot usdm_futures; do
  echo -n "  $m: "; find "$G/capture/$m" -name '*.csv' 2>/dev/null | wc -l | tr -d '\n'; echo -n " csv, "
  find "$G/capture/$m" -name '*.parquet' 2>/dev/null | wc -l | tr -d '\n'; echo " parquet"
done
du -sh "$G/capture" 2>/dev/null
echo -n "  jsonl de metricas: "; ls -l "$G/capture/jean_flow_metrics.jsonl" 2>/dev/null | awk '{print $5" bytes"}'

echo
echo "=== tamano de los csv si estan ==="
find "$G/capture" -name '*.csv' -printf '%s\n' 2>/dev/null | awk '{s+=$1}END{printf "  %.2f GiB en %d ficheros\n", s/1073741824, NR}'

echo
echo "=== huellas de los informes (la verdad a reproducir) ==="
for f in journal_spot journal_usdm identity metrics; do
  echo -n "  $f.json: "; sha256sum "$G/audit/$f.json" 2>/dev/null | cut -c1-16
done
echo "G4_OK"
