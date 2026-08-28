#!/usr/bin/env bash
# Solo el IP publico y las claves autorizadas. Salida corta a proposito:
# el puente devuelve unicamente los ultimos 4000 caracteres.
set +e
M="http://metadata.google.internal/computeMetadata/v1"
H="Metadata-Flavor: Google"

echo "IP PUBLICO : $(curl -s -m 5 -H "$H" "$M/instance/network-interfaces/0/access-configs/0/external-ip")"
echo "IP INTERNO : $(curl -s -m 5 -H "$H" "$M/instance/network-interfaces/0/ip")"
echo "MAQUINA    : $(curl -s -m 5 -H "$H" "$M/instance/name")"
echo "ZONA       : $(curl -s -m 5 -H "$H" "$M/instance/zone" | awk -F/ '{print $NF}')"
echo "PROYECTO   : $(curl -s -m 5 -H "$H" "$M/project/project-id")"
echo
echo "USUARIO PARA CONECTAR: trading"
echo "PUERTO: 22    PROTOCOLO: SFTP"
echo
echo "=== claves autorizadas para trading (huellas y comentario) ==="
ssh-keygen -lf /home/trading/.ssh/authorized_keys 2>/dev/null
echo
echo "=== ¿alguna parece venir de un Windows? ==="
grep -oE '[^ ]+@[^ ]+$' /home/trading/.ssh/authorized_keys 2>/dev/null | sort -u
echo "IP_OK"
