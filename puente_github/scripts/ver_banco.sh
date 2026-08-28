#!/usr/bin/env bash
set +e
O=/home/trading/banco_auditparquet
PID=/home/trading/banco_auditparquet.pid
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "CORRIENDO"; else echo "TERMINADO"; fi
echo
echo "=== los errores ==="
for f in pq_journal_spot pq_journal_usdm pq_identity csv_journal_spot csv_journal_usdm csv_identity; do
  s=$(stat -c%s "$O/informes/$f.err" 2>/dev/null)
  echo "--- $f.err ($s bytes) ---"
  tail -12 "$O/informes/$f.err" 2>/dev/null
done
echo
echo "=== el log completo desde el paso 2 ==="
sed -n '/auditor NUEVO sobre PARQUET/,$p' "$O/banco.log" 2>/dev/null | head -60
echo "VB2_OK"
