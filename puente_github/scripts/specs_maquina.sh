#!/usr/bin/env bash
# Ficha técnica de la VM (solo lectura; seguro con captura activa).
echo "=== CPU ==="
nproc
grep -m1 'model name' /proc/cpuinfo
grep -c ^processor /proc/cpuinfo
echo "=== MEMORIA (GB) ==="
free -g | head -2
echo "=== DISCO ==="
df -h / | tail -1
echo "=== KERNEL / SO ==="
uname -r
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
echo "=== UPTIME ==="
uptime -p
echo "=== PYTHON DEL COLECTOR ==="
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python -V
echo "=== SERVICIOS JEAN FLOW ==="
for s in jean-flow-router jean-flow-gemini jean-flow-bridge cloudflared puente-github desktop-commander-remote; do
  printf '%s: %s\n' "$s" "$(systemctl is-active $s 2>/dev/null || echo no-existe)"
done
echo SPECS_OK
