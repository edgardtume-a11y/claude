#!/usr/bin/env bash
# ¿Hay riesgo de grabar cada precio de marca DOS veces? config.py tiene dos
# listas de flujos y markPrice esta en ambas. Si los dos sockets estan activos
# a la vez para el mismo mercado, cada evento entraria duplicado.
# El mismo riesgo aplicaria a forceOrder, que ya estaba en las dos.
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice
S="$N/overlay/src/binance_collector"

echo "=== las dos funciones que listan flujos ==="
grep -n 'def .*stream\|def .*url\|def .*socket' "$S/config.py" | head -20

echo
echo "=== contexto de la primera lista (linea ~292) ==="
sed -n '275,310p' "$S/config.py"

echo
echo "=== contexto de la segunda (linea ~330) ==="
sed -n '320,355p' "$S/config.py"

echo
echo "=== ¿quien llama a cada una? ==="
for fn in $(grep -oP 'def \K[a-z_]+(?=\()' "$S/config.py" | sort -u); do
  c=$(grep -rn "\.$fn\b" "$S"/*.py 2>/dev/null | grep -v 'config.py:' | head -3)
  [ -n "$c" ] && { echo "  $fn:"; echo "$c" | sed 's/^/    /'; }
done

echo
echo "=== ¿como se abren los sockets en collector.py? ==="
grep -n -iE 'socket|connect|stream_url|_streams\(' "$S/collector.py" | head -25
echo "DOBLE_OK"
