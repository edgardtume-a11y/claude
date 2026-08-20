#!/usr/bin/env bash
# Comprueba un servidor MCP de terminal, local o publicado por tunel.
#
# Uso:
#   bash comprobar.sh                       # contra 127.0.0.1:8765
#   bash comprobar.sh https://x.trycloudflare.com
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${1:-http://127.0.0.1:${MCP_TERMINAL_PUERTO:-8765}}"

if [ ! -f "$AQUI/.token" ]; then
  echo "ERROR: no encuentro $AQUI/.token. Lanza antes publicar_tunel.sh"
  exit 1
fi
TOKEN="$(cat "$AQUI/.token")"

echo "Comprobando $BASE"
echo

echo -n "1. /salud ................. "
SALUD="$(curl -s --max-time 15 "$BASE/salud")"
echo "$SALUD" | grep -q 'terminal-local' && echo "OK" || { echo "FALLO"; echo "   $SALUD"; }

echo -n "2. rechaza sin token ...... "
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$BASE/mcp" -d '{"jsonrpc":"2.0","id":1,"method":"ping"}')"
[ "$CODIGO" = "401" ] && echo "OK (401)" || echo "FALLO (esperaba 401, llego $CODIGO)"

echo -n "3. tools/list con token ... "
LISTA="$(curl -s --max-time 15 -X POST "$BASE/mcp/$TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')"
if echo "$LISTA" | grep -q 'run_command'; then
  echo "OK ($(echo "$LISTA" | grep -o '"name"' | wc -l) herramientas)"
else
  echo "FALLO"
  echo "   ${LISTA:-(respuesta vacia)}"
fi

echo -n "4. ejecuta un comando ..... "
SALIDA="$(curl -s --max-time 20 -X POST "$BASE/mcp/$TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"echo prueba-ok"}}}')"
echo "$SALIDA" | grep -q 'prueba-ok' && echo "OK" || { echo "FALLO"; echo "   ${SALIDA:-(respuesta vacia)}"; }

echo -n "5. flujo de autorizacion .. "
if command -v python3 >/dev/null 2>&1 && [ -f "$AQUI/prueba_flujo.py" ]; then
  if python3 "$AQUI/prueba_flujo.py" "$BASE" >/tmp/flujo-oauth.txt 2>&1; then
    echo "OK"
  else
    echo "FALLO (detalle en /tmp/flujo-oauth.txt)"
    tail -5 /tmp/flujo-oauth.txt | sed 's/^/   /'
  fi
else
  echo "omitido (falta python3)"
fi

echo
echo "URL para el conector de claude.ai (sin token, usa OAuth):"
echo "   $BASE/mcp"
echo
echo "URL con token directo (curl y scripts):"
echo "   $BASE/mcp/$TOKEN"
