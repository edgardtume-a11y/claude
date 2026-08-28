#!/usr/bin/env bash
# Autoriza la llave publica del PC Windows del operador para el usuario trading.
#
# Es una llave PUBLICA: sirve para que la maquina reconozca al operador, no para
# entrar a ningun sitio por si sola. La mitad privada (tokio.ppk) esta solo en
# su PC y no ha salido de ahi.
#
# Se comprueba antes de escribir:
#   - que la linea es una llave valida (ssh-keygen la sabe leer)
#   - que no esta ya autorizada (no duplicar)
# Y despues se dejan los permisos que ssh exige, que si estan mal el servidor
# rechaza la conexion sin explicar por que.
set +e
SSH_DIR=/home/trading/.ssh
AUTH="$SSH_DIR/authorized_keys"

LLAVE='ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCNvJkK1V1zWvcKEPFT3XVcp0Lp+CrgMIO0k+LRqS1AWFPCTDn641AXKaGHl9nVlCFiNq0ew4O9bXjgKMMieGRj9W/AwxtenDhxBEDt2Y+kipYznpmMqL4wwcMBiJfB48oJUiPxqdWiNT0UjUSIqd1CARmfnpk9nTMyIFg3b1z9S1ca2HVhnyGADrWVNMP2kreTrphupGVLQwroMJYzFwM/M59UhUyCaGVVnzer5JIqnUZCgK7YwKJ/2/tt2+8+yhbDOpGHSZR8W3NXE1jzDO2r5nFnyb1bMhP+WWDISwGfi1JiGx9V4TPhRE/E4JrLYIm3ZIQ2eAyXPZbiwVl25xxT rsa-key-20260827'

echo "=== 1) ¿es una llave valida? ==="
TMP=$(mktemp)
printf '%s\n' "$LLAVE" > "$TMP"
if ssh-keygen -lf "$TMP" >/dev/null 2>&1; then
  echo "  SI: $(ssh-keygen -lf "$TMP")"
else
  echo "  *** NO ES UNA LLAVE VALIDA - no se escribe nada ***"
  rm -f "$TMP"
  exit 1
fi

echo
echo "=== 2) ¿ya estaba autorizada? ==="
CUERPO=$(awk '{print $2}' "$TMP")
if [ -f "$AUTH" ] && grep -qF "$CUERPO" "$AUTH"; then
  echo "  YA ESTABA - no se duplica"
  YA=1
else
  echo "  no estaba: se anade"
  YA=0
fi

if [ "$YA" -eq 0 ]; then
  echo
  echo "=== 3) anadiendo ==="
  mkdir -p "$SSH_DIR"
  # copia de seguridad del fichero antes de tocarlo
  [ -f "$AUTH" ] && cp -a "$AUTH" "$AUTH.antes_$(date -u +%Y%m%dT%H%M%SZ)"
  printf '%s\n' "$LLAVE" >> "$AUTH"
  echo "  anadida"
fi
rm -f "$TMP"

echo
echo "=== 4) permisos que exige ssh ==="
chmod 700 "$SSH_DIR" 2>/dev/null
chmod 600 "$AUTH" 2>/dev/null
ls -ld "$SSH_DIR"
ls -l "$AUTH"

echo
echo "=== 5) llaves autorizadas ahora ==="
ssh-keygen -lf "$AUTH" 2>/dev/null

echo
echo "=== 6) el servicio ssh esta escuchando ==="
systemctl is-active ssh 2>/dev/null
ss -tln 2>/dev/null | grep -E ':22\b' | head -2

echo "AUTORIZAR_OK"
