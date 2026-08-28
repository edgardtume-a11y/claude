#!/usr/bin/env bash
# SOSPECHA: el diff parece QUITAR la comprobacion de columnas v2 que faltan.
# Venia de reader.fieldnames, que un generador no tiene. Si se ha eliminado en
# vez de reimplementarse, la certificacion queda MAS DEBIL que antes, y eso es
# exactamente lo que el encargo prohibia.
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
V=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector/audit.py"; W="$V/overlay/src/binance_collector/audit.py"

echo "=== 1) ¿sigue existiendo la comprobacion de columnas que faltan? ==="
echo -n "  ANTES  'missing_columns': "; grep -c 'missing_columns' "$W"
echo -n "  AHORA  'missing_columns': "; grep -c 'missing_columns' "$S"
echo -n "  ANTES  'faltan columnas': "; grep -c 'faltan columnas' "$W"
echo -n "  AHORA  'faltan columnas': "; grep -c 'faltan columnas' "$S"
echo "  --- donde esta ahora ---"
grep -n -B6 -A8 'missing_columns\|faltan columnas' "$S" | head -40

echo
echo "=== 2) _IDENTITY_COLUMNS: ¿se sigue usando? ==="
grep -n '_IDENTITY_COLUMNS' "$S"

echo
echo "=== 3) la resolucion de rutas: ¿que sufijos acepta ahora? ==="
grep -n -B10 -A14 'csv.partial' "$S" | head -45

echo
echo "=== 4) el otro sitio (identity, ~linea 518 antes): ¿tenia esa comprobacion? ==="
grep -n -c 'fieldnames' "$W" | sed 's/^/  fieldnames ANTES: /'
grep -n -c 'fieldnames' "$S" | sed 's/^/  fieldnames AHORA: /'
grep -n 'fieldnames' "$S"
echo "APCOL_OK"
