#!/usr/bin/env bash
# Respaldo comprimido de todo /home/trading (el proyecto completo) para
# descarga con WinSCP o similar. NO ejecutar con captura activa.
set -e
if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "ABORTADO: hay una captura activa; ejecutar tras el cierre del gate"
  exit 1
fi
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/home/trading/respaldo_jean_flow_${TS}.tar.gz
tar --exclude='*/__pycache__' --exclude='*/.pytest_cache' \
    --exclude='/home/trading/.npm' --exclude='/home/trading/.cache' \
    --exclude='/home/trading/puente_github_repo' \
    --exclude='/home/trading/respaldo_jean_flow_*.tar.gz' \
    -czf "$OUT" -C /home trading
ls -lh "$OUT"
echo "RESPALDO_OK $OUT"
