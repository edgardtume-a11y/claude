#!/usr/bin/env bash
# Arranca al obrero de la conversion en segundo plano y DEVUELVE ENSEGUIDA.
#
# Este es el patron correcto para el puente: lanzar y soltar. Una orden que se
# queda esperando bloquea la cola entera, porque el guardian atiende las ordenes
# de una en una (ver operaciones/LECCION_PUENTE_SERIAL.md).
set +e
OBRERO=/home/trading/puente_github_repo/puente_github/scripts/conversion_obrero.sh
LOG=/home/trading/conversion_parquet.log

if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "HAY UNA CAPTURA ACTIVA - conversion abortada"
  exit 1
fi

if pgrep -f 'conversion_obrero[.]sh' >/dev/null; then
  echo "YA HAY UNA CONVERSION EN MARCHA - no se lanza otra"
  tail -5 "$LOG" 2>/dev/null
  exit 0
fi

if [ ! -f "$OBRERO" ]; then
  echo "no se encuentra el obrero en $OBRERO"
  exit 1
fi

nohup bash "$OBRERO" > "$LOG" 2>&1 &
echo "obrero lanzado, pid=$!"
echo "registro: $LOG"
echo "LANZAR_OK"
