#!/usr/bin/env bash
# RESPALDO INCREMENTAL: solo lo NUEVO desde el respaldo anterior.
#
# Orden del operador (28/08/2026): "a partir de ahora crearas otra carpeta
# donde solo iran los nuevos archivos creados despues de esta copia".
#
# Como funciona la marca:
#   /home/trading/respaldo_incremental/.ultima_marca guarda el instante exacto
#   (segundos desde 1970) hasta el que ya esta respaldado. Cada corrida coge
#   todo lo posterior a esa marca y, SOLO SI TERMINA BIEN, la adelanta.
#
#   Que la marca se actualice al final y no al principio es lo que impide el
#   peor fallo posible de un incremental: que una corrida falle a medias, la
#   marca ya haya avanzado, y esos ficheros no aparezcan nunca en ningun
#   respaldo. Es preferible repetir ficheros a perderlos.
#
# La marca inicial es el arranque del respaldo completo del 28/08 a las
# 03:08:04 UTC, que es justo lo que el operador ya tiene en su disco.
set +e
OBRERO=/home/trading/puente_github_repo/puente_github/scripts/respaldo_total_obrero.py
BASE=/home/trading/respaldo_incremental
MARCA_FILE="$BASE/.ultima_marca"
LOG="$BASE/incremental.log"
# 2026-08-28T03:08:04Z, inicio del respaldo completo
MARCA_INICIAL=1787886484

mkdir -p "$BASE"

if pgrep -f 'respaldo_total_obrero' >/dev/null; then
  echo "YA HAY UN RESPALDO EN MARCHA - no se lanza otro"
  exit 0
fi
if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "HAY UNA CAPTURA ACTIVA - incremental aplazado para no competir con ella"
  exit 0
fi

if [ -f "$MARCA_FILE" ]; then
  DESDE=$(cat "$MARCA_FILE")
else
  DESDE=$MARCA_INICIAL
  echo "primera corrida: se parte del respaldo completo del 28/08 03:08:04 UTC"
fi

AHORA=$(date -u +%s)
SELLO=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$BASE/$SELLO"
mkdir -p "$DEST"

echo "desde : $(date -u -d @"$DESDE" +%Y-%m-%dT%H:%M:%SZ)"
echo "hasta : $(date -u -d @"$AHORA" +%Y-%m-%dT%H:%M:%SZ)"
echo "destino: $DEST"
echo

nohup /usr/bin/python3 "$OBRERO" \
  --desde-epoch "$DESDE" \
  --destino-dir "$DEST" \
  --prefijo "INCREMENTAL" \
  --parte-mb 2048 > "$LOG" 2>&1 &
PID=$!
echo "lanzado pid=$PID"

# la marca se adelanta en un guion aparte, solo cuando el obrero termine bien
cat > "$BASE/.cerrar_marca.sh" <<EOF
#!/usr/bin/env bash
# Adelanta la marca SOLO si el incremental de $SELLO acabo bien.
while kill -0 $PID 2>/dev/null; do sleep 10; done
if grep -q 'JEAN_FLOW_RESPALDO_TOTAL_OK' "$LOG" 2>/dev/null; then
  echo $AHORA > "$MARCA_FILE"
  echo "marca adelantada a $AHORA ($(date -u -d @$AHORA +%Y-%m-%dT%H:%M:%SZ))" >> "$LOG"
else
  echo "EL INCREMENTAL NO TERMINO BIEN: la marca NO se adelanta." >> "$LOG"
  echo "La proxima corrida volvera a incluir estos ficheros." >> "$LOG"
fi
EOF
chmod +x "$BASE/.cerrar_marca.sh"
nohup bash "$BASE/.cerrar_marca.sh" >/dev/null 2>&1 &
echo "vigilante de la marca lanzado"
echo "registro: $LOG"
echo "INCREMENTAL_LANZADO_OK"
