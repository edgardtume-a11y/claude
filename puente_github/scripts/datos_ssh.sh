#!/usr/bin/env bash
# Datos que hacen falta para conectar por SFTP desde WinSCP.
# No se muestra ninguna clave privada ni contrasena: solo lo necesario para
# saber a donde conectar y con que metodo.
set +e

echo "=== 1) IP publica de la maquina ==="
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" 2>/dev/null
echo
echo "--- IP interna ---"
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip" 2>/dev/null
echo
echo "--- nombre y zona ---"
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/name" 2>/dev/null
echo
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/zone" 2>/dev/null
echo

echo
echo "=== 2) ¿esta el servicio SSH escuchando? ==="
ss -tlnp 2>/dev/null | grep -E ':22\b' || echo "(no se ve el puerto 22)"
systemctl is-active ssh sshd 2>/dev/null

echo
echo "=== 3) metodos de acceso permitidos (sin mostrar claves) ==="
sudo -n grep -E '^\s*(PasswordAuthentication|PubkeyAuthentication|PermitRootLogin|AuthorizedKeysFile)' \
  /etc/ssh/sshd_config 2>/dev/null || \
  grep -E '^\s*(PasswordAuthentication|PubkeyAuthentication)' /etc/ssh/sshd_config 2>/dev/null || \
  echo "(no se puede leer la configuracion de ssh sin permisos de administrador)"

echo
echo "=== 4) ¿el usuario trading tiene claves autorizadas? ==="
if [ -f /home/trading/.ssh/authorized_keys ]; then
  echo "  si: $(wc -l < /home/trading/.ssh/authorized_keys) clave(s) autorizada(s)"
  echo "  huellas (identifican la clave, NO son la clave):"
  ssh-keygen -lf /home/trading/.ssh/authorized_keys 2>/dev/null | head -5
else
  echo "  NO existe /home/trading/.ssh/authorized_keys"
fi

echo
echo "=== 5) usuarios con carpeta propia (posibles usuarios de conexion) ==="
ls -1 /home 2>/dev/null

echo
echo "=== 6) OS Login activado? (cambia como se conecta uno) ==="
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/enable-oslogin" 2>/dev/null || echo "(no definido a nivel de instancia)"
echo
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/project/attributes/enable-oslogin" 2>/dev/null || echo "(no definido a nivel de proyecto)"
echo
echo "DATOS_SSH_OK"
