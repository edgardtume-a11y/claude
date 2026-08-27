#!/usr/bin/env bash
# Obrero de la conversion: recorre TODAS las capturas terminadas, las convierte
# a Parquet y borra los CSV originales tras verificarlos en esa misma pasada.
#
# Va de la mas pequena a la mas grande: si algo sale mal, sale mal barato.
#
# Este guion NO se lanza directamente por el puente: lo arranca en segundo plano
# conversion_lanzar.sh, para no dejar la cola de ordenes bloqueada (ver
# operaciones/LECCION_PUENTE_SERIAL.md).
#
# Autorizacion: orden expresa del operador del 27/08/2026.
# Respaldo: verificacion del conversor (tabla + filas + columnas), verificacion
# independiente del revisor (parser distinto, 288 000 celdas, 0 discrepancias),
# y vuelta atras probada (el auditor certifica el CSV reconstruido, rc=0).
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
BASE=/home/trading/jean-flow-exec/staging_runs

echo "=== INICIO $(date -u +%FT%TZ) ==="
df -h /home | tail -1

for d in $(du -s "$BASE"/* 2>/dev/null | sort -n | cut -f2); do
  [ -d "$d/capture" ] || continue
  n=$(find "$d/capture" -name '*.csv' 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] || continue
  echo
  echo "######## $(basename "$d")  [$n CSV]  $(date -u +%H:%M:%S)"
  "$PY" "$H" --staging "$d" --borrar 2>&1
  df -h /home | tail -1
done

echo
echo "=== FIN $(date -u +%FT%TZ) ==="
df -h /home | tail -1
du -sh "$BASE" 2>/dev/null
echo "CSV que quedan: $(find "$BASE" -name '*.csv' 2>/dev/null | wc -l)"
echo "parquet creados: $(find "$BASE" -name '*.parquet' 2>/dev/null | wc -l)"
echo "CONVERSION_TOTAL_TERMINADA"
