#!/usr/bin/env bash
# Migración JEAN FLOW: clonar jean-flow-01 (Singapur) → jean-flow-02-tokyo (asia-northeast1)
# Ejecutado con éxito el 27/08/2026 (~07:06 UTC). Guardado como referencia notarial.
# LECCIÓN: antes de crear la imagen, limpiar credenciales de agentes (desktop-commander)
# para que el clon no herede/queme la identidad del padre.
set -e
LOG=/home/trading/migracion_tokio.log
exec >> "$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) INICIO MIGRACION ==="
if pgrep -f binance_collector.dual_main; then
  echo "ABORTADO: hay captura activa; reintentar tras el cierre del gate"
  exit 1
fi
TS=$(date -u +%Y%m%dT%H%M%SZ)
IMG=$(echo "jean-flow-mig-${TS}" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9-')
echo "--- 1/3 machine image $IMG (en caliente) ---"
gcloud compute machine-images create "$IMG" \
  --source-instance=jean-flow-01 \
  --source-instance-zone=asia-southeast1-a \
  --storage-location=asia
echo "--- 2/3 VM jean-flow-02-tokyo (e2-standard-4 por cuota CPUS_ALL_REGIONS=12) ---"
gcloud compute instances create jean-flow-02-tokyo \
  --zone=asia-northeast1-a \
  --source-machine-image="$IMG" \
  --machine-type=e2-standard-4
echo "--- 3/3 estado ---"
gcloud compute instances describe jean-flow-02-tokyo --zone=asia-northeast1-a \
  --format='value(name,status,networkInterfaces[0].networkIP,networkInterfaces[0].accessConfigs[0].natIP)'
echo "=== $(date -u +%FT%TZ) MIGRACION LANZADA OK ==="
