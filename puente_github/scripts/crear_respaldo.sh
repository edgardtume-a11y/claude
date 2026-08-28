#!/usr/bin/env bash
# Crea el respaldo de verdad, en segundo plano.
#
# El simulacro ya paso: 5197 ficheros, 943 MB de origen, inventario completo con
# lo incluido y lo excluido. Ahora se ejecuta sin --dry-run.
#
# En segundo plano porque comprimir con LZMA casi un giga tarda mucho mas que el
# limite de una orden del puente (leccion de operaciones/LECCION_PUENTE_SERIAL.md).
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/jean-flow-exec/herramientas/respaldo_maestro.py
LOG=/home/trading/respaldo_maestro.log
DEST=/home/trading/RESPALDO_JEAN_FLOW_$(date -u +%Y%m%dT%H%M%SZ).zip

if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "HAY UNA CAPTURA ACTIVA - respaldo abortado"
  exit 1
fi
if pgrep -f 'respaldo_maestro[.]py' >/dev/null; then
  echo "YA HAY UN RESPALDO EN MARCHA"
  tail -10 "$LOG" 2>/dev/null
  exit 0
fi
if [ ! -f "$H" ]; then
  echo "no existe $H"
  exit 1
fi

echo "destino: $DEST"
nohup "$PY" "$H" --destino "$DEST" > "$LOG" 2>&1 &
echo "lanzado pid=$!"
echo "registro: $LOG"
echo "CREAR_RESPALDO_OK"
