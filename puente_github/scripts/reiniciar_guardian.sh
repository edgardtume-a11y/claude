#!/usr/bin/env bash
# Reinicia el guardian SIN matarse a si mismo.
#
# El truco: se lanza el reinicio en segundo plano con un retardo, y este guion
# termina enseguida. Asi el guardian alcanza a escribir el resultado de esta
# orden ANTES de que el reinicio lo tumbe. Si no, se queda la orden sin
# resultado y al arrancar la repite: bucle.
set +e
echo "programando reinicio en 20 s (tiempo para que el guardian cierre esta orden)"
nohup bash -c 'sleep 20; systemctl restart puente-github 2>/dev/null || sudo -n systemctl restart puente-github 2>/dev/null' >/dev/null 2>&1 &
echo "REINICIO_PROGRAMADO_OK"
