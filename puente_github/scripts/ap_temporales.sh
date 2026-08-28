#!/usr/bin/env bash
# SEGUNDA SOSPECHA: el glob de .parquet NO excluye ningun temporal.
#   resolved.update(path for path in candidate.glob("*.parquet"))
# Para CSV existe el apreton de manos .csv.partial y el auditor lo respeta.
# Para Parquet, ¿como nombra parquet_store el fichero mientras lo escribe?
# Si el temporal acaba en .parquet, el auditor podria leer un fichero A MEDIO
# ESCRIBIR durante la rotacion en vivo de los 7 dias.
set +e
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
echo "=== como escribe parquet_store: temporal y renombrado ==="
grep -n -iE 'tmp|temp|partial|\.replace\(|os\.replace|rename|suffix|with_suffix|write_table' "$B/parquet_store.py" | head -25
echo
echo "=== el sitio del write_table, con contexto ==="
grep -n -B12 -A12 'write_table' "$B/parquet_store.py" | head -40
echo
echo "=== ¿que nombres hay hoy en un directorio ya convertido? ==="
ls -a /home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/capture/spot/ 2>/dev/null
echo "TMP_OK"
