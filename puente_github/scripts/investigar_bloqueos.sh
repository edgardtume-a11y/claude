#!/usr/bin/env bash
# ¿Que puede estar bloqueando el bucle de eventos 19 ms? Se busca trabajo
# sincrono y pesado dentro de corrutinas: eso es lo unico que puede parar el bucle.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== A) rebases del libro: el sospechoso numero uno ==="
grep -n 'def .*rebase\|REBASE\|hot_rebase\|_rebuild\|preventive' "$SRC/order_book.py" | head -15

echo
echo "=== B) llamadas bloqueantes dentro de corrutinas (sin await) ==="
grep -n 'time.sleep\|\.join()\|os.fsync\|\.flush()\|subprocess.run\|open(' "$SRC/collector.py" | head -15

echo
echo "=== C) el fsync del escritor: en el hilo o en el bucle? ==="
grep -n 'fsync\|flush\|def _run\|threading' "$SRC/writer.py" | head -15

echo
echo "=== D) sonda del retraso del bucle: como se mide ==="
grep -rn 'event_loop_lag\|loop_lag\|probe_missed\|_probe' "$SRC"/*.py | head -12

echo
echo "=== E) trabajo pesado por mensaje en el camino caliente ==="
grep -n 'for .* in .*levels\|sorted(\|bisect\|dumps(' "$SRC/order_book.py" "$SRC/collector.py" | head -15
echo "INVESTIGAR_BLOQUEOS_OK"
