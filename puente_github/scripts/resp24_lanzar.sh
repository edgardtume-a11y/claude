#!/usr/bin/env bash
# Lanza el respaldo del 24 en adelante EN SEGUNDO PLANO y devuelve enseguida.
# Comprimir gigabytes no cabe en el limite de una orden del puente.
set +e
OBRERO=/home/trading/puente_github_repo/puente_github/scripts/respaldo_total_obrero.py
LOG=/home/trading/respaldo_24.log
DEST=/home/trading/respaldo_24_27

if pgrep -f 'respaldo_total_obrero' >/dev/null; then
  echo "YA ESTA CORRIENDO"
  tail -15 "$LOG" 2>/dev/null
  exit 0
fi
# limpiar restos de un intento anterior interrumpido, si los hubiera
rm -f "$DEST"/*.escribiendo 2>/dev/null

mkdir -p "$DEST"
nohup /usr/bin/python3 "$OBRERO" --desde 2026-08-24 \
  --destino-dir "$DEST" --parte-mb 2048 > "$LOG" 2>&1 &
echo "lanzado pid=$!"
echo "destino : $DEST"
echo "registro: $LOG"
echo "LANZAR_24_OK"
