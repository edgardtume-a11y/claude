#!/usr/bin/env bash
# Acelera el puente y trata de resucitar RDC, que es la via rapida de verdad.
#
# Medido: cada orden tarda 40-90 s, de los cuales unos 5 son trabajo real.
# El resto es espera, y casi toda viene de dos numeros:
#   - POLL_SECONDS=30 en el guardian: duerme media rondа de media
#   - el limite de 600 s por orden, que permite que un trabajo largo tapone
#     la cola entera (paso dos veces anoche)
#
# Se bajan los dos. Y se intenta levantar el agente de RDC, que da conexion
# directa sin git en medio: ~1 s por orden en vez de 40-90.
set +e
W=/home/trading/puente_github_repo/puente_github/watcher.py
INSTALADO=$(systemctl show -p ExecStart puente-github 2>/dev/null | grep -oE '/[^ ]*watcher\.py' | head -1)
[ -n "$INSTALADO" ] && W="$INSTALADO"

echo "=== 1) guardian en uso: $W ==="
grep -n 'POLL_SECONDS\|timeout=600' "$W" 2>/dev/null

echo
echo "=== 2) bajando el sondeo de 30 s a 5 s ==="
sudo -n sed -i 's/^POLL_SECONDS = 30$/POLL_SECONDS = 5/' "$W" 2>/dev/null \
  || sed -i 's/^POLL_SECONDS = 30$/POLL_SECONDS = 5/' "$W" 2>/dev/null
grep -n '^POLL_SECONDS' "$W"

echo
echo "=== 3) bajando el tope por orden de 600 s a 120 s ==="
# obliga a que todo lo largo se lance en segundo plano, en vez de taponar
sudo -n sed -i 's/timeout=600)/timeout=120)/' "$W" 2>/dev/null \
  || sed -i 's/timeout=600)/timeout=120)/' "$W" 2>/dev/null
grep -n 'timeout=' "$W" | head -5

echo
echo "=== 4) NO se reinicia el guardian desde aqui ==="
# NUNCA reiniciar el servicio que esta ejecutando este mismo script: se mata a
# si mismo a mitad de la orden, arranca de nuevo, ve la orden sin resultado y
# la repite. Bucle de reinicio. Paso el 28/08 y dejo el puente ciego 18 minutos.
# El reinicio va en una orden aparte, con nohup y retardo, para que el guardian
# alcance a escribir su resultado antes de morir.
echo "  (el reinicio se hace en una orden separada, ver reiniciar_guardian.sh)"

echo
echo "=== 5) RDC: la via rapida. ¿por que esta caido? ==="
systemctl list-units --all 2>/dev/null | grep -iE 'desktop|commander|dcagent' | head -5
pgrep -af 'desktop.commander|dcagent|desktop_commander' | head -3
echo "--- servicios con 'dc' o 'commander' en el nombre ---"
ls /etc/systemd/system/ 2>/dev/null | grep -iE 'desktop|commander|dc-' | head -5
ls ~/.config/systemd/user/ 2>/dev/null | grep -iE 'desktop|commander' | head -5

echo
echo "=== 6) ¿hay instalacion de desktop commander en el disco? ==="
ls -d /opt/*commander* /opt/*desktop* /home/trading/.desktop* 2>/dev/null
find /home/trading -maxdepth 3 -iname '*desktop*commander*' 2>/dev/null | head -5
echo "ACELERAR_OK"
