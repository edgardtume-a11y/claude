#!/usr/bin/env bash
# PISTA NUEVA: el panel publica mas veces que mensajes llegan.
#
# En una ventana real de metricas del gate 3:
#   websocket_messages ......... 189
#   dashboard_publish_ok ....... 142
#   dashboard_publish_book_ok ... 48
#   dashboard_publish_trade_ok .. 91
#   -> 281 publicaciones para 189 mensajes
#
# Si cada publicacion serializa estado dentro del bucle de eventos, eso es
# trabajo constante en el camino caliente. Y en una captura de 7 dias sin nadie
# mirando, es trabajo COMPLETAMENTE INUTIL.
#
# Encaja con la hipotesis de saturacion: no bloquea, pero suma tareas.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) ¿que hace --dashboard-port 0? ==="
grep -n 'dashboard_port\|dashboard-port' "$SRC/dual_main.py" | head -10

echo
echo "=== B) ¿se puede apagar el panel del todo? ==="
grep -rn 'no.dashboard\|dashboard_enabled\|disable_dashboard\|if.*dashboard' "$SRC/dual_main.py" | head -10

echo
echo "=== C) que cuesta cada publicacion ==="
grep -n 'def publish\|def _publish\|dashboard_publish' "$SRC/dashboard.py" | head -12

echo
echo "=== D) ¿serializa en el bucle o en otro sitio? ==="
grep -n 'orjson.dumps\|json.dumps\|await \|asyncio' "$SRC/dashboard.py" | head -15

echo
echo "=== E) desde donde se llama a publicar (el camino caliente) ==="
grep -n 'publish' "$SRC/collector.py" | head -15

echo
echo "=== F) la validacion con sorted() del libro ==="
sed -n '380,395p' "$SRC/order_book.py"
echo "--- ¿cada cuanto se llama esa validacion? ---"
grep -n 'def .*valid\|_validate\|assert_sorted' "$SRC/order_book.py" | head -10
echo "PANEL_OK"
