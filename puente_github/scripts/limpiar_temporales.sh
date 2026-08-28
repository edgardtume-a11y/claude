#!/usr/bin/env bash
# Limpieza de lo que YO deje tirado esta noche haciendo pruebas.
#
# Solo toca directorios que cree el revisor durante las pruebas de hoy y que
# estan vacios de valor: copias temporales para verificar la vuelta atras y
# laboratorios de prueba del conversor. NO toca ninguna captura, ningun
# respaldo, ningun dato del operador.
#
# Se lista antes de borrar, para que quede constancia de que se borro.
set +e

echo "=== lo que voy a borrar, y por que ==="
for d in \
  /home/trading/vuelta_atras_tmp \
  /home/trading/parquet_lab \
  /home/trading/banco_gil_tmp \
  /home/trading/banco_compresion \
  /home/trading/reversibilidad_tmp \
  /home/trading/jean-flow-exec/staging_runs/lab_parquet_store \
  /home/trading/jean-flow-exec/staging_runs/lab_rotador
do
  if [ -e "$d" ]; then
    echo "  $(du -sh "$d" 2>/dev/null | cut -f1)  $d"
  fi
done

echo
echo "=== ficheros sueltos de prueba ==="
for f in \
  /home/trading/objetivo_conversion.txt \
  /home/trading/convertir_todo_worker.sh \
  /home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/parquet_store_lectura.txt
do
  [ -e "$f" ] && echo "  $(stat -c%s "$f") bytes  $f"
done

echo
echo "=== borrando ==="
rm -rf /home/trading/vuelta_atras_tmp \
       /home/trading/parquet_lab \
       /home/trading/banco_gil_tmp \
       /home/trading/banco_compresion \
       /home/trading/reversibilidad_tmp \
       /home/trading/jean-flow-exec/staging_runs/lab_parquet_store \
       /home/trading/jean-flow-exec/staging_runs/lab_rotador
rm -f /home/trading/objetivo_conversion.txt \
      /home/trading/convertir_todo_worker.sh \
      /home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/parquet_store_lectura.txt
echo "hecho"

echo
echo "=== comprobacion: lo que NO se toco sigue ahi ==="
echo "  capturas comprimidas : $(find /home/trading/jean-flow-exec/staging_runs -name '*.parquet' | wc -l) parquet"
echo "  capturas antiguas    : $(find /home/trading/restore_stage_20260825 -name '*.csv' | wc -l) csv"
echo "  respaldo del operador: $(ls -la /home/trading/RESPALDO_JEAN_FLOW_*.zip 2>/dev/null | wc -l) fichero(s)"

echo
echo "=== disco ==="
df -h /home | tail -1
echo "LIMPIAR_OK"
