#!/usr/bin/env bash
# PRUEBA DEL ROTADOR. La importante es la tercera: que NO toque un fichero que
# la captura tiene abierto. De eso depende que se pueda usar en vivo.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
SRCROOT=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src
R=/home/trading/jean-flow-exec/herramientas/rotador_parquet.py
REC=/home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py
BASE=/home/trading/jean-flow-exec/staging_runs
LAB=$BASE/lab_rotador

echo "=== 0) preparar un laboratorio con un CSV real y uno ABIERTO ==="
rm -rf "$LAB"; mkdir -p "$LAB/capture/spot"
P=$(find "$BASE" -name '*.parquet' -not -path '*lab_*' -printf '%s %p\n' 2>/dev/null | sort -n | head -1 | cut -d' ' -f2)
"$PY" "$REC" --parquet "$P" --destino "$LAB/capture/spot/cerrado.csv" >/dev/null 2>&1

# el fichero que simula estar en uso por la captura: mismo contenido, sufijo .partial
cp "$LAB/capture/spot/cerrado.csv" "$LAB/capture/spot/abierto.csv.partial"
HUELLA_ABIERTO=$(sha256sum "$LAB/capture/spot/abierto.csv.partial" | cut -c1-16)

ls -la "$LAB/capture/spot/"
echo "huella del fichero ABIERTO: $HUELLA_ABIERTO"

echo
echo "=== 1) PRIMERA PASADA: sin --borrar. Debe convertir y CONSERVAR ==="
PYTHONPATH="$SRCROOT" "$PY" "$R" --run "$LAB" --una-vez 2>&1 | tail -12
echo "--- estado despues ---"
echo "  csv cerrados : $(find "$LAB/capture" -name '*.csv' | wc -l)  (debe ser 1)"
echo "  csv abiertos : $(find "$LAB/capture" -name '*.partial' | wc -l)  (debe ser 1)"
echo "  parquet      : $(find "$LAB" -name '*.parquet' | wc -l)"

echo
echo "=== 2) SEGUNDA PASADA: con --borrar. Debe reverificar y BORRAR el cerrado ==="
PYTHONPATH="$SRCROOT" "$PY" "$R" --run "$LAB" --una-vez --borrar 2>&1 | tail -12
echo "--- estado despues ---"
echo "  csv cerrados : $(find "$LAB/capture" -name '*.csv' | wc -l)  (debe ser 0)"
echo "  parquet      : $(find "$LAB" -name '*.parquet' | wc -l)"

echo
echo "=== 3) LA PRUEBA CRITICA: ¿toco el fichero abierto? ==="
if [ -f "$LAB/capture/spot/abierto.csv.partial" ]; then
  NUEVA=$(sha256sum "$LAB/capture/spot/abierto.csv.partial" | cut -c1-16)
  echo "  el .partial SIGUE EXISTIENDO"
  echo "  huella antes:   $HUELLA_ABIERTO"
  echo "  huella despues: $NUEVA"
  if [ "$HUELLA_ABIERTO" = "$NUEVA" ]; then
    echo "  ==> INTACTO. El rotador respeta el fichero en uso."
  else
    echo "  ==> *** LO MODIFICO. INACEPTABLE ***"
  fi
else
  echo "  *** EL .partial DESAPARECIO. FALLO GRAVE ***"
fi
echo "  parquet creados a partir del .partial: $(find "$LAB" -name 'abierto*' -name '*.parquet' | wc -l)  (debe ser 0)"

echo
echo "=== 4) ¿aborta si hay una captura activa? (regla S1/R-captura) ==="
grep -n 'dual_main' "$R" | head -3

echo
echo "=== 5) limpieza ==="
rm -rf "$LAB"
echo "PROBAR_ROTADOR_OK"
