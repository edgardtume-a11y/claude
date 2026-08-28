#!/usr/bin/env bash
# 0xb5 en la posicion 19 = alguien esta leyendo un Parquet como si fuera texto
# UTF-8. Hay que averiguar QUIEN: si _iterar_filas funciona, el fallo esta en
# otro sitio que tambien abre el fichero y que no se convirtio.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
S="$N/overlay/src/binance_collector"
P=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/capture/spot/events-20260827T203002.737505Z-000001.parquet

echo "=== 1) ¿funciona _iterar_filas por si solo? ==="
PYTHONPATH="$N/overlay/src" "$PY" - <<PYCODE
import traceback
from binance_collector.audit import _iterar_filas
try:
    it = _iterar_filas("$P")
    r = next(iter(it))
    print("  OK. columnas:", len(r))
    print("  primeras claves:", list(r)[:6])
    print("  tipos:", {k: type(v).__name__ for k, v in list(r.items())[:4]})
except Exception:
    traceback.print_exc()
PYCODE

echo
echo "=== 2) TODOS los sitios que abren ficheros en audit.py ==="
grep -n -E '\.open\(|open\(|read_text|read_bytes|readline|readlines' "$S/audit.py"

echo
echo "=== 3) donde se imprime AUDIT FAIL ==="
grep -n -B12 -A4 'AUDIT FAIL' "$S/audit.py"

echo
echo "=== 4) reproducir con traza completa ==="
PYTHONPATH="$N/overlay/src" "$PY" - <<PYCODE
import sys, traceback
sys.argv = ["audit", "journal", "$P"]
import binance_collector.audit as A
# buscamos la funcion que hace el trabajo del subcomando journal
import inspect
for nombre, obj in vars(A).items():
    if nombre.startswith("_"): continue
    if inspect.isfunction(obj) and "journal" in nombre.lower():
        print("  candidata:", nombre, inspect.signature(obj))
try:
    A.main()
except SystemExit as e:
    print("  SystemExit:", e.code)
except Exception:
    traceback.print_exc()
PYCODE
echo "DIAG_OK"
