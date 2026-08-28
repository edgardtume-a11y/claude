#!/usr/bin/env bash
# Programa el respaldo incremental para que corra SOLO, sin depender de nadie.
#
# Orden del operador: "de ahora todo ira en la carpeta de respaldo".
# Para que eso sea cierto de verdad, no puede depender de que alguien se acuerde
# de lanzarlo: tiene que estar en el reloj de la maquina.
#
# Cada 4 horas. El guion ya trae sus propias guardas:
#   - no corre si hay una captura activa (no compite con la grabacion)
#   - no corre si ya hay otro respaldo en marcha
#   - la marca solo avanza si termino bien
# Asi que ejecutarlo de mas es inofensivo: si no toca, se sale solo.
set +e
GUION=/home/trading/puente_github_repo/puente_github/scripts/respaldo_incremental.sh
MARCA="# JEAN FLOW respaldo incremental automatico"

echo "=== 1) estado de la primera corrida ==="
tail -12 /home/trading/respaldo_incremental/incremental.log 2>/dev/null || echo "(sin registro aun)"
echo
echo "--- carpetas de incrementales ---"
ls -la /home/trading/respaldo_incremental/ 2>/dev/null | head -10
echo "--- marca actual ---"
if [ -f /home/trading/respaldo_incremental/.ultima_marca ]; then
  M=$(cat /home/trading/respaldo_incremental/.ultima_marca)
  echo "  $M = $(date -u -d @"$M" +%Y-%m-%dT%H:%M:%SZ)"
else
  echo "  (aun no se ha adelantado: la primera corrida no ha cerrado)"
fi

echo
echo "=== 2) programando en el reloj de la maquina ==="
if crontab -l 2>/dev/null | grep -qF "$MARCA"; then
  echo "  YA ESTABA PROGRAMADO"
else
  ( crontab -l 2>/dev/null; \
    echo "$MARCA"; \
    echo "0 */4 * * * /usr/bin/flock -n /tmp/jf_incremental.lock bash $GUION >> /home/trading/respaldo_incremental/cron.log 2>&1" \
  ) | crontab -
  echo "  programado: cada 4 horas"
fi

echo
echo "=== 3) como queda el reloj ==="
crontab -l 2>/dev/null | tail -6

echo
echo "=== 4) espacio ==="
df -h /home | tail -1
echo "PROGRAMAR_OK"
