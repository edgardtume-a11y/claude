# MCP: terminal local

Servidor MCP (transporte **stdio**) que expone la terminal de tu maquina a
Claude Code. Sin dependencias: solo Node, que ya viene con Claude Code.

Probado en Linux (Parrot/Debian) y preparado para Windows y macOS.

## Que hace

| Herramienta | Para que sirve |
|---|---|
| `run_command` | Ejecuta un comando y espera. Devuelve salida + codigo de salida. |
| `start_process` | Lanza algo en segundo plano (servidores, watchers, builds) y devuelve un id. |
| `read_output` | Lee lo nuevo que ha escrito un proceso en segundo plano. |
| `write_stdin` | Responde a prompts interactivos (confirmaciones, sudo, REPLs). |
| `kill_process` | Mata el proceso y todo su arbol de hijos. |
| `list_processes` | Lista los procesos vivos de la sesion. |
| `set_cwd` | Cambia el directorio de trabajo, y persiste entre comandos. |
| `system_info` | SO, usuario, shell, CPU, memoria, directorio actual. |

## Instalacion

### Linux / macOS

```bash
cd ~/mcp/claude/mcp-terminal
bash instalar.sh
```

### Windows

Doble clic en `INSTALAR_MCP_TERMINAL.cmd`, o desde PowerShell:

```powershell
.\INSTALAR_MCP_TERMINAL.cmd
```

El instalador comprueba `node` y `claude`, hace un saludo MCP de prueba
contra el servidor y solo entonces lo registra.

### A mano

```bash
claude mcp add terminal-local --scope user -- node /ruta/a/servidor_terminal_mcp.js
```

Comprueba con `claude mcp list`, y dentro de Claude Code con `/mcp`.

## Donde se ejecutan los comandos

Un servidor MCP stdio **corre en la misma maquina que el cliente que lo lanza**.
Es decir: los comandos se ejecutan en el ordenador donde arrancas `claude`.

Una sesion de Claude Code en la web vive en un contenedor en la nube y no tiene
ruta de red hacia tu equipo, asi que **no puede** usar este servidor. Para que
funcione, abre Claude Code en tu propia terminal:

```bash
claude
```

## Seguridad

Este servidor esta configurado como **shell completa sin restricciones**: puede
ejecutar cualquier comando con tus permisos de usuario. Eso es lo que se pidio,
y es lo mismo que ya hace la herramienta Bash de Claude Code.

Si algun dia quieres acotarlo, en `servidor_terminal_mcp.js` esta preparado el
interruptor:

```js
const ALLOWLIST = [/^git( |$)/, /^npm( |$)/, /^docker( |$)/];
```

Con eso, todo lo que no case con alguna expresion se rechaza. `null` (el valor
actual) significa sin restricciones.

## Variables de entorno

| Variable | Por defecto | Efecto |
|---|---|---|
| `MCP_TERMINAL_CWD` | directorio actual | Directorio de trabajo inicial. |
| `MCP_TERMINAL_TIMEOUT` | `120000` | Timeout por defecto de `run_command`, en ms. |
| `MCP_TERMINAL_MAX_SALIDA` | `120000` | Maximo de caracteres devueltos por llamada. |

## Diagnostico

El servidor escribe trazas en **stderr** (stdout esta reservado para JSON-RPC).
Para probarlo suelto, sin Claude Code:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"system_info","arguments":{}}}' \
  | node servidor_terminal_mcp.js
```

Debes ver dos lineas JSON de respuesta.
