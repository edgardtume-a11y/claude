# MCP: terminal local

Expone la terminal de tu maquina a Claude mediante MCP. Sin dependencias:
solo Node.

Dos transportes, para dos situaciones distintas:

| Archivo | Transporte | Para que |
|---|---|---|
| `servidor_terminal_mcp.js` | stdio | Claude Code corriendo **en tu maquina** |
| `servidor_terminal_http.js` | HTTP + SSE | Cliente **remoto** (Claude web) a traves de un tunel |
| `oauth_terminal.js` | — | Autorizacion OAuth que exige claude.ai |

Los dos comparten `nucleo_terminal.js`, donde viven las herramientas.

## Que herramientas expone

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

## Camino A: Claude Code en tu maquina (stdio)

Es el camino simple y el que no expone nada a internet.

```bash
sudo apt install -y nodejs                      # si falta node
curl -fsSL https://claude.ai/install.sh | bash  # si falta claude
bash instalar.sh
claude
```

Dentro de Claude Code, `/mcp` debe listar `terminal-local`.

En Windows: doble clic en `INSTALAR_MCP_TERMINAL.cmd`.

A mano:

```bash
claude mcp add terminal-local --scope user -- node /ruta/servidor_terminal_mcp.js
```

**Nota util:** Claude Code ya trae una herramienta Bash propia. Si solo quieres
"que Claude use mi terminal", el camino A te sirve sin instalar este servidor.
Lo que este añade es el trabajo en segundo plano con `start_process` /
`read_output` / `write_stdin`, y el mismo juego de herramientas por HTTP.

## Camino B: terminal accesible desde Claude web (HTTP)

Un servidor MCP stdio corre en la misma maquina que el cliente que lo lanza.
Una sesion de Claude en la web vive en un contenedor en la nube y no tiene ruta
hacia tu equipo, asi que para llegar hasta ella hay que salir por HTTP y
publicar el servidor con un tunel.

```bash
bash publicar_tunel.sh
```

El script:

1. genera un token estable (`.token`, ignorado por git) si no existe;
2. arranca `servidor_terminal_http.js` **solo en loopback**;
3. abre un tunel con `cloudflared`;
4. comprueba de extremo a extremo que la URL publica responde `tools/list`;
5. imprime la URL final.

Luego, en claude.ai, añade un conector personalizado con esta URL, **sin
token**:

```
https://<tu-tunel>.trycloudflare.com/mcp
```

Al pulsar "Conectar", claude.ai no usa un token escrito a mano: arranca el
flujo de autorizacion de MCP (OAuth). Por eso la URL va limpia.

Requisitos: `cloudflared` instalado, y un plan que permita conectores
personalizados.

### Autenticacion

Hay dos mecanismos, y conviven:

**1. OAuth** — el que usa claude.ai. Implementado en `oauth_terminal.js`:

| Pieza | Norma | Endpoint |
|---|---|---|
| Metadatos del recurso protegido | RFC 9728 | `/.well-known/oauth-protected-resource` |
| Metadatos del servidor de autorizacion | RFC 8414 | `/.well-known/oauth-authorization-server` |
| Registro dinamico de cliente | RFC 7591 | `POST /register` |
| Codigo de autorizacion con PKCE | RFC 7636 | `/authorize` + `/token` |

Un 401 sin credenciales devuelve `WWW-Authenticate` apuntando al metadata, que
es lo que hace que el cliente arranque el flujo en vez de rendirse.

Como el servidor es de un solo usuario detras de un tunel privado, la pantalla
de autorizacion **se aprueba sola**: la seguridad descansa en que la URL del
tunel sea secreta. Para exigir aprobacion explicita:

```bash
MCP_TERMINAL_APROBACION_MANUAL=1 bash publicar_tunel.sh
```

Entonces `/authorize` muestra una pagina que pide el token del servidor.

**2. Token estatico** — para `curl` y scripts propios. Se acepta de tres formas,
porque no todos los clientes dejan poner cabeceras:

- `Authorization: Bearer <token>`
- en la ruta: `/mcp/<token>`
- en la query: `?token=<token>`

El token se guarda en `.token` (fuera de git, permisos 600) y el servidor lo
reutiliza entre arranques. Las comparaciones son en tiempo constante. Sin
credencial valida, todo devuelve 401.

## Seguridad

Este servidor es una **shell completa sin restricciones**: puede ejecutar
cualquier comando con tus permisos. En el camino A eso equivale a lo que ya
hace Claude Code. En el camino B, ademas, queda detras de una URL publica:
quien tenga URL y token tiene tu maquina.

Recomendaciones para el camino B:

- levanta el tunel solo mientras lo uses y cierralo con Ctrl+C;
- no pegues la URL completa en sitios publicos ni en issues;
- si se filtra, borra `.token` y vuelve a lanzar el script para rotarlo.

Para acotar que se puede ejecutar, en `nucleo_terminal.js`:

```js
const ALLOWLIST = [/^git( |$)/, /^npm( |$)/, /^docker( |$)/];
```

Todo lo que no case con alguna expresion se rechaza. `null` (el valor actual)
significa sin restricciones.

## Variables de entorno

| Variable | Por defecto | Efecto |
|---|---|---|
| `MCP_TERMINAL_CWD` | directorio actual | Directorio de trabajo inicial. |
| `MCP_TERMINAL_TIMEOUT` | `120000` | Timeout por defecto de `run_command`, en ms. |
| `MCP_TERMINAL_MAX_SALIDA` | `120000` | Maximo de caracteres devueltos por llamada. |
| `MCP_TERMINAL_PUERTO` | `8765` | Puerto del servidor HTTP. |
| `MCP_TERMINAL_HOST` | `127.0.0.1` | Interfaz de escucha. Dejalo en loopback. |
| `MCP_TERMINAL_TOKEN` | `.token` o aleatorio | Token estatico del servidor HTTP. |
| `MCP_TERMINAL_APROBACION_MANUAL` | `0` | `1` exige aprobar el OAuth con el token. |

## Diagnostico

Las trazas van a **stderr**; en stdio, stdout esta reservado para JSON-RPC.

Probar el stdio suelto:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"system_info","arguments":{}}}' \
  | node servidor_terminal_mcp.js
```

Probar el HTTP:

```bash
MCP_TERMINAL_TOKEN=prueba node servidor_terminal_http.js &
curl -s http://127.0.0.1:8765/salud
curl -s -X POST http://127.0.0.1:8765/mcp/prueba -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Estado de las pruebas

Verificado en Linux x86_64 con Node 22:

- stdio: handshake, `tools/list`, `run_command`, codigos de salida distintos
  de cero, `timeout_ms` matando el arbol de procesos, `set_cwd` persistente,
  errores controlados sin caida;
- HTTP: 401 sin token y con token incorrecto, token por cabecera / ruta / query,
  `202` en notificaciones, `tools/call` real;
- SSE: evento `endpoint`, respuestas por el canal SSE, `404` en sesion
  desconocida;
- OAuth (`prueba_flujo.py`, 24 comprobaciones): descubrimiento, registro
  dinamico, PKCE S256, redireccion con `state` conservado, canje del codigo,
  rechazo al reusar un codigo, rechazo con PKCE incorrecto, llamada MCP con el
  token emitido y rechazo de un token inventado;
- detras del tunel (`prueba_tunel.py`): `issuer` y endpoints construidos con el
  dominio publico HTTPS a partir de `X-Forwarded-Proto` / `X-Forwarded-Host`,
  sin filtrar `127.0.0.1`.

Para repetirlas:

```bash
node servidor_terminal_http.js --puerto 8765 &
bash comprobar.sh                  # las 5 fases, incluida la de OAuth
python3 prueba_flujo.py            # solo el flujo de autorizacion
python3 prueba_tunel.py            # solo las URLs publicas
```
