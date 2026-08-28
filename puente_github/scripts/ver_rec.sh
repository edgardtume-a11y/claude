#!/usr/bin/env bash
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
S="$N/overlay/src/binance_collector"
echo -n "  _iterar_filas en reconstruct.py: "; grep -c 'def _iterar_filas' "$S/reconstruct.py"
echo -n "  _iterar_filas en audit.py (debe ser 0 defs): "; grep -c 'def _iterar_filas' "$S/audit.py"
echo -n "  audit.py lo importa: "; grep -c 'from .reconstruct import.*_iterar_filas' "$S/audit.py"
echo -n "  DictReader que quedan en reconstruct.py: "; grep -c 'DictReader' "$S/reconstruct.py"
echo -n "  parquet en reconstruct.py: "; grep -ci 'parquet' "$S/reconstruct.py"
echo "  fechas: audit $(stat -c '%y' "$S/audit.py" | cut -c12-19)  reconstruct $(stat -c '%y' "$S/reconstruct.py" | cut -c12-19)   ahora $(date -u +%H:%M:%S)"
echo -n "  propietario reconstruct.py: "; stat -c '%U:%G' "$S/reconstruct.py"
echo -n "  ¿toco la BASE? (0): "; grep -ci 'parquet' /home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector/reconstruct.py
echo "VR_OK"
