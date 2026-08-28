#!/usr/bin/env bash
# El esquema exacto: columnas, tipos de registro y version.
# Hace falta para saber si se pueden anadir flujos nuevos SIN romper el esquema
# ni la certificacion, que es la pregunta que decide el coste del cambio.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== columnas del CSV (CSV_FIELDS) ==="
sed -n '/^CSV_FIELDS/,/^)/p' "$SRC/models.py" | head -50

echo
echo "=== version del esquema y tipos de registro ==="
grep -n 'SCHEMA_VERSION\|SUPPORTED_SCHEMA' "$SRC/models.py" | head -5
grep -n 'RECORD_TYPES\|record_type' "$SRC/models.py" | head -15

echo
echo "=== flujos de websocket que se abren hoy ==="
grep -n 'aggTrade\|depth\|@ticker\|markPrice\|forceOrder\|bookTicker\|streams=' "$SRC/collector.py" | head -20
echo "ESQUEMA_OK"
