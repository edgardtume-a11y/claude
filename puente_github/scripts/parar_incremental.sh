#!/usr/bin/env bash
# PARADA DE EMERGENCIA del incremental.
#
# Fallo detectado: el incremental esta respaldando el respaldo completo. La
# carpeta /home/trading/respaldo_24_27 tiene fecha posterior a la marca, asi que
# entra en la ventana. Resultado: 31.86 GB copiados dentro de otro zip, sin
# ningun valor, comiendo disco a toda velocidad.
#
# Es el error clasico del respaldo que se muerde la cola. Lo previne para el
# directorio de destino de la propia corrida, pero no para los respaldos
# anteriores.
#
# Se para, se borra lo generado (que es basura por construccion) y se quita del
# reloj hasta arreglarlo. NO se toca ningun dato del operador.
set +e

echo "=== 1) parando los procesos ==="
pkill -f 'respaldo_total_obrero' && echo "  obrero detenido" || echo "  (no habia obrero)"
pkill -f 'cerrar_marca' && echo "  vigilante detenido" || echo "  (no habia vigilante)"
sleep 2
pgrep -af 'respaldo_total_obrero|cerrar_marca' || echo "  ninguno vivo"

echo
echo "=== 2) quitandolo del reloj hasta que este arreglado ==="
crontab -l 2>/dev/null | grep -v 'respaldo_incremental' | grep -v 'JEAN FLOW respaldo incremental' | crontab -
echo "  quitado. reloj ahora:"
crontab -l 2>/dev/null | tail -3 || echo "  (vacio)"

echo
echo "=== 3) lo generado por la corrida fallida ==="
du -sh /home/trading/respaldo_incremental/* 2>/dev/null

echo
echo "=== 4) borrando SOLO la salida del incremental fallido ==="
echo "    (es basura por construccion: copias de un respaldo que ya existe)"
rm -rf /home/trading/respaldo_incremental/20260828T*
rm -f /home/trading/respaldo_incremental/.ultima_marca
echo "  hecho"

echo
echo "=== 5) COMPROBACION: lo que NO se toco ==="
echo "  respaldo completo : $(ls /home/trading/respaldo_24_27/*.zip 2>/dev/null | wc -l) partes"
echo "  capturas parquet  : $(find /home/trading/jean-flow-exec/staging_runs -name '*.parquet' 2>/dev/null | wc -l)"
echo "  capturas antiguas : $(find /home/trading/restore_stage_20260825 -name '*.csv' 2>/dev/null | wc -l) csv"

echo
echo "=== 6) disco recuperado ==="
df -h /home | tail -1
echo "PARAR_OK"
