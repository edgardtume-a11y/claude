#!/usr/bin/env bash
# Registra el servidor de terminal en Claude Code (Linux / macOS).
# Uso:  bash instalar.sh
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVIDOR="$AQUI/servidor_terminal_mcp.js"
NOMBRE="terminal-local"

echo "== Comprobando requisitos =="

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: no encuentro 'node'. Instalalo con:  sudo apt install -y nodejs"
  exit 1
fi
echo "  node ......... $(node --version)"

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: no encuentro 'claude'. Instala Claude Code con:"
  echo "       curl -fsSL https://claude.ai/install.sh | bash"
  exit 1
fi
echo "  claude ....... instalado"

if [ ! -f "$SERVIDOR" ]; then
  echo "ERROR: no encuentro $SERVIDOR"
  exit 1
fi

echo
echo "== Prueba del servidor =="
RESPUESTA=$(printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"instalador","version":"1"}}}' \
  | timeout 15 node "$SERVIDOR" 2>/dev/null | head -1)

if ! echo "$RESPUESTA" | grep -q '"serverInfo"'; then
  echo "ERROR: el servidor no respondio al saludo MCP."
  exit 1
fi
echo "  handshake .... correcto"

echo
echo "== Registrando en Claude Code =="
claude mcp remove "$NOMBRE" --scope user >/dev/null 2>&1 || true
claude mcp add "$NOMBRE" --scope user -- node "$SERVIDOR"

echo
claude mcp list
echo
echo "Listo. Abre Claude Code con 'claude' y comprueba con /mcp."
