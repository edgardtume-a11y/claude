#!/usr/bin/env bash
set +e
N=$(ls -dt /home/trading/jean-flow-exec/staging_runs/*auditparquet* 2>/dev/null | head -1)
if [ -z "$N" ]; then echo "STAGING: todavia no"; exit 0; fi
echo "staging: $N"
A="$N/overlay/src/binance_collector/audit.py"
echo -n "  menciones de parquet/pyarrow en audit.py del overlay: "; grep -icE 'parquet|pyarrow' "$A"
echo -n "  _iterar_filas o equivalente: "; grep -c -iE 'def _iterar_filas|def _iter_rows|def _leer_filas' "$A"
echo -n "  test_audit_parquet.py: "; [ -f "$N/overlay/tests/test_audit_parquet.py" ] && echo SI || echo NO
echo -n "  DictReader (debe seguir existiendo): "; grep -c 'DictReader' "$A"
echo "  fecha audit.py: $(stat -c '%y' "$A" | cut -c1-19)   ahora: $(date -u +%H:%M:%S)"
echo -n "  ¿toco la BASE? (debe ser 0): "; grep -icE 'parquet|pyarrow' /home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector/audit.py
echo "AP_OK"
