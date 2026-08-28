#!/usr/bin/env bash
# El guardian que CORRE es /home/trading/puente_github_watcher.py, no la copia
# del repositorio. Antes de tocarlo hay que leer el que de verdad se ejecuta.
set +e
G=/home/trading/puente_github_watcher.py
echo "=== 1) que fichero corre de verdad ==="
systemctl cat puente-github 2>/dev/null | grep -E 'ExecStart|WorkingDirectory|Restart|User'
echo
ps -eo pid,etime,cmd | grep -i 'puente_github_watcher' | grep -v grep

echo
echo "=== 2) los numeros que gobiernan la latencia del puente ==="
grep -n -iE 'POLL|SLEEP|INTERVAL|TIMEOUT|time\.sleep|_SECONDS|_SEGUNDOS' "$G" | head -30

echo
echo "=== 3) tamano y fecha ==="
ls -l "$G"; sha256sum "$G" | cut -c1-16

echo
echo "=== 4) ¿como reinicia el servicio? (para no suicidarse otra vez) ==="
ls -l /home/trading/reiniciar_guardian.sh 2>/dev/null || echo "  no existe reiniciar_guardian.sh"
echo "VER_GUARDIAN_OK"
