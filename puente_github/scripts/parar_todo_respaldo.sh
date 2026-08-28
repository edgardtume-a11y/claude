#!/usr/bin/env bash
# Para TODO lo relacionado con respaldos. El operador dijo que ya no quiere mas
# copias, y ademas estan saturando el disco y ralentizando el guardian.
# No se borra nada: solo se detiene.
set +e
echo "=== procesos de respaldo vivos ==="
pgrep -af 'respaldo_total_obrero|cerrar_marca|respaldo_maestro' | head
echo
echo "=== deteniendo ==="
pkill -f 'respaldo_total_obrero' && echo "  obrero detenido" || echo "  (no habia)"
pkill -f 'cerrar_marca'          && echo "  vigilante detenido" || echo "  (no habia)"
pkill -f 'respaldo_maestro'      && echo "  maestro detenido" || echo "  (no habia)"
echo
echo "=== quitando del reloj ==="
crontab -l 2>/dev/null | grep -v 'respaldo_incremental' | grep -v 'JEAN FLOW respaldo' | crontab -
crontab -l 2>/dev/null | wc -l
echo
echo "=== carga y disco ahora ==="
uptime
df -h /home | tail -1
echo
echo "=== lo que se conserva intacto ==="
echo "  respaldo reducido : $(ls -la /home/trading/RESPALDO_JEAN_FLOW_*.zip 2>/dev/null | wc -l)"
echo "  respaldo completo : $(ls /home/trading/respaldo_24_27/*.zip 2>/dev/null | wc -l) partes"
echo "PARAR_TODO_OK"
