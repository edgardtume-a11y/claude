#!/bin/bash
# grabar_1dia.sh — lanza 24 h de grabacion de BTCUSDT en su propia carpeta.
#
# Que lanza (tres procesos independientes, cada uno con su PID y su log):
#   libro        100 niveles del libro, spot y futuros, 1 foto/s   (registrar_libro.py)
#   trades_fut   operaciones ejecutadas en futuros, con lado agresor (registrar_trades.py)
#   trades_spot  operaciones ejecutadas en spot, con lado agresor    (registrar_trades.py)
#
# Todo cae en DEST. Los scripts viven en BASE y no se tocan.
# Se para solo a las 24 h (DURACION_S) cerrando bien los gzip.
# Idempotente: si un proceso ya corre, no lo duplica.
set -u

BASE=/home/trading/basis
DEST=${DEST:-/home/trading/grabaciones_btc_dia_1_09_2026}
DUR=${DURACION_S:-86400}
SIM=${SIMBOLO:-BTCUSDT}

mkdir -p "$DEST" || { echo "no puedo crear $DEST"; exit 1; }
cd "$BASE" || { echo "no existe $BASE"; exit 1; }
for f in registrar_libro.py registrar_trades.py; do
    [ -f "$f" ] || { echo "falta $BASE/$f"; exit 1; }
done

lanzar() {
    local nombre=$1; shift
    local pidf="$DEST/$nombre.pid"
    if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
        echo "  $nombre: YA CORRE (pid $(cat "$pidf"))"
        return 0
    fi
    nohup "$@" >> "$DEST/$nombre.log" 2>&1 &
    echo $! > "$pidf"
    echo "  $nombre: arrancado (pid $!)"
}

echo "Lanzando grabacion de $DUR s en $DEST"
lanzar libro       env SIMBOLO="$SIM" NIVELES=100 CADENCIA_S=1 DURACION_S="$DUR" \
                       SALIDA="$DEST/libro.jsonl.gz"       python3 registrar_libro.py
lanzar trades_fut  env SIMBOLO="$SIM" MERCADO=fut  CADENCIA_S=1 DURACION_S="$DUR" \
                       SALIDA="$DEST/trades_fut.jsonl.gz"  python3 registrar_trades.py
lanzar trades_spot env SIMBOLO="$SIM" MERCADO=spot CADENCIA_S=1 DURACION_S="$DUR" \
                       SALIDA="$DEST/trades_spot.jsonl.gz" python3 registrar_trades.py

{
    date -u "+inicio      : %Y-%m-%d %H:%M:%S UTC"
    date -u -d "+${DUR} seconds" "+fin previsto: %Y-%m-%d %H:%M:%S UTC"
    echo "simbolo     : $SIM"
    echo "duracion    : $DUR s"
} > "$DEST/INICIO.txt"
echo
cat "$DEST/INICIO.txt"
echo
echo "Para ver el estado:  bash $BASE/estado_grabacion.sh"
echo "Para parar antes  :  bash $BASE/estado_grabacion.sh parar   (SIGTERM, cierra gzip bien)"
