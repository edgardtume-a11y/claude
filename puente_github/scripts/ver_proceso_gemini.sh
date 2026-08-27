#!/usr/bin/env bash
# ¿El encargo de Gemini esta trabajando de verdad o se colgo?
# Un job en estado "running" durante 40 minutos puede ser cualquiera de las dos
# cosas. La diferencia se ve en la maquina: o hay un proceso gastando CPU, o no.
set +e

echo "=== hora UTC: $(date -u +%H:%M:%S) ==="
echo
echo "=== ¿corre el banco de pruebas? ==="
pgrep -af 'banco_gil' | head -5
echo "(vacio = no se esta ejecutando)"

echo
echo "=== procesos del agente Gemini ==="
pgrep -af 'gemini' | head -8
echo "(vacio = ninguno)"

echo
echo "=== carga de la maquina ==="
uptime
echo
echo "=== los 5 procesos que mas CPU consumen ==="
ps -eo pcpu,etime,user,comm --sort=-pcpu --no-headers | head -5

echo
echo "=== salud del router ==="
python3 - <<'PYEOF'
import json, socket
try:
    s = socket.socket(socket.AF_UNIX)
    s.settimeout(10)
    s.connect("/run/jean-flow-router.sock")
    s.sendall(json.dumps({"method": "health", "payload": {}}).encode() + b"\n")
    s.shutdown(socket.SHUT_WR)
    print(s.makefile().readline().strip()[:600])
except Exception as exc:
    print("router no responde:", exc)
PYEOF

echo
echo "=== permisos del banco ==="
ls -la /home/trading/jean-flow-exec/herramientas/ 2>&1 | head
echo "VER_PROCESO_OK"
