#!/usr/bin/env bash
# Levanta el servidor MCP por HTTP y lo publica con un tunel de Cloudflare.
# Al final imprime la URL exacta que hay que pegar en el conector.
#
# Uso:  bash publicar_tunel.sh
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTO="${MCP_TERMINAL_PUERTO:-8765}"
REGISTRO="$(mktemp -t mcp-tunel-XXXXXX.log)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: falta node.  sudo apt install -y nodejs"
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  cat <<'AYUDA'
ERROR: falta cloudflared. Instalalo con:

  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared-linux-amd64.deb

AYUDA
  exit 1
fi

# Token estable entre reinicios: si cambiara, habria que reconfigurar el
# conector cada vez que se levanta el tunel.
ARCHIVO_TOKEN="$AQUI/.token"
if [ ! -f "$ARCHIVO_TOKEN" ]; then
  node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))' > "$ARCHIVO_TOKEN"
  chmod 600 "$ARCHIVO_TOKEN"
  echo "Token nuevo generado en $ARCHIVO_TOKEN"
fi
TOKEN="$(cat "$ARCHIVO_TOKEN")"

limpiar() {
  echo
  echo "Cerrando..."
  [ -n "${PID_TUNEL:-}" ] && kill "$PID_TUNEL" 2>/dev/null
  [ -n "${PID_SERVIDOR:-}" ] && kill "$PID_SERVIDOR" 2>/dev/null
  exit 0
}
trap limpiar INT TERM

echo "== Arrancando el servidor MCP en 127.0.0.1:$PUERTO =="
MCP_TERMINAL_TOKEN="$TOKEN" node "$AQUI/servidor_terminal_http.js" --puerto "$PUERTO" &
PID_SERVIDOR=$!
sleep 2

if ! kill -0 "$PID_SERVIDOR" 2>/dev/null; then
  echo "ERROR: el servidor no arranco."
  exit 1
fi

echo "== Abriendo el tunel =="
cloudflared tunnel --url "http://127.0.0.1:$PUERTO" --no-autoupdate > "$REGISTRO" 2>&1 &
PID_TUNEL=$!

PUBLICA=""
for _ in $(seq 1 40); do
  PUBLICA="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$REGISTRO" | head -1)"
  [ -n "$PUBLICA" ] && break
  sleep 1
done

if [ -z "$PUBLICA" ]; then
  echo "ERROR: el tunel no dio URL. Registro en $REGISTRO"
  limpiar
fi

echo
echo "== Comprobando de extremo a extremo =="
RESPUESTA="$(curl -s --max-time 20 -X POST "$PUBLICA/mcp/$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')"

if echo "$RESPUESTA" | grep -q 'run_command'; then
  echo "  el tunel responde y expone las herramientas: OK"
else
  echo "  AVISO: el tunel no devolvio la lista de herramientas."
  echo "  respuesta: $RESPUESTA"
fi

cat <<RESUMEN

  ==================================================================
  URL para el conector personalizado (Streamable HTTP):

    $PUBLICA/mcp/$TOKEN

  Si el cliente pide transporte SSE, usa en su lugar:

    $PUBLICA/sse/$TOKEN

  Cualquiera que tenga esa URL puede ejecutar comandos en esta
  maquina con tus permisos. No la pegues en sitios publicos.

  Deja esta terminal abierta. Ctrl+C cierra el tunel y el servidor.
  ==================================================================

RESUMEN

wait
