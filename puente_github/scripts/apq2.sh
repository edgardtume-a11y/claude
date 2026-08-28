#!/usr/bin/env bash
set +e
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
echo "=== ¿audit.py sabe de Parquet? ==="
echo -n "  menciones parquet/pyarrow: "; grep -icE 'parquet|pyarrow' "$B/audit.py"
grep -n -iE 'parquet|pyarrow' "$B/audit.py" | head -8
echo
echo "=== como abre los ficheros ==="
grep -n -iE '\bopen\(|csv\.reader|DictReader|gzip|newline=' "$B/audit.py" | head -10
echo
echo "=== los tres subcomandos ==="
grep -n -E 'add_parser|set_defaults' "$B/audit.py" | head -12
echo
echo "=== el guion de auditorias de un staging certificado ==="
G=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/control/run_live_audits.sh
[ -f "$G" ] && sed -n '1,60p' "$G" || echo "  no existe $G"
echo "APQ2_OK"
