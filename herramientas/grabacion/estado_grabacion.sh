#!/bin/bash
# estado_grabacion.sh — estado de la grabacion de 24 h, o pararla limpiamente.
#   bash estado_grabacion.sh          -> estado
#   bash estado_grabacion.sh parar    -> SIGTERM a los tres (cierran el gzip bien)
set -u
DEST=${DEST:-/home/trading/grabaciones_btc_dia_1_09_2026}
[ -d "$DEST" ] || { echo "no existe $DEST"; exit 1; }

if [ "${1:-}" = "parar" ]; then
    for n in libro trades_fut trades_spot; do
        p=$(cat "$DEST/$n.pid" 2>/dev/null)
        if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then
            kill -TERM "$p" && echo "  $n: SIGTERM enviado a $p"
        else
            echo "  $n: no corria"
        fi
    done
    sleep 3
fi

echo "=== $DEST ==="
cat "$DEST/INICIO.txt" 2>/dev/null
echo
for n in libro trades_fut trades_spot; do
    p=$(cat "$DEST/$n.pid" 2>/dev/null)
    if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then est="VIVO   pid $p"; else est="PARADO"; fi
    sz=$(du -h "$DEST/$n"*.jsonl.gz 2>/dev/null | cut -f1 | head -1)
    ult=$(tail -1 "$DEST/$n.log" 2>/dev/null | cut -c1-90)
    printf "  %-12s %-16s %6s  %s\n" "$n" "$est" "${sz:-0}" "$ult"
done
echo
df -h /home | tail -1 | awk '{print "  disco: usado "$3" de "$2" ("$5")"}'
date -u "+  ahora: %Y-%m-%d %H:%M:%S UTC"
