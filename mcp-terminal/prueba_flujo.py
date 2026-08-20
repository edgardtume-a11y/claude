#!/usr/bin/env python3
"""Simula el flujo completo que sigue un conector remoto de claude.ai.

Descubrimiento -> registro dinamico -> autorizacion con PKCE -> canje del
codigo -> llamada MCP autenticada con el token emitido.

Uso:  python3 prueba_flujo.py [base]     (por defecto http://127.0.0.1:8765)
"""
import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
fallos = []


def pedir(metodo, url, cuerpo=None, cabeceras=None, seguir=True):
    datos = None
    cab = dict(cabeceras or {})
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode()
        cab["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=datos, headers=cab, method=metodo)

    class SinRedireccion(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    abridor = urllib.request.build_opener() if seguir else urllib.request.build_opener(SinRedireccion)
    try:
        with abridor.open(req, timeout=15) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def comprobar(nombre, condicion, detalle=""):
    print(f"  {'OK  ' if condicion else 'FALLO'}  {nombre}")
    if not condicion:
        fallos.append(nombre)
        if detalle:
            print(f"         {detalle[:300]}")


print(f"Flujo OAuth contra {BASE}\n")

# 1. El cliente pide /mcp sin credenciales y espera un 401 que le diga a donde ir.
print("1. Descubrimiento")
codigo, cab, cuerpo = pedir("POST", f"{BASE}/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
comprobar("POST /mcp sin token devuelve 401", codigo == 401, f"llego {codigo}")
comprobar(
    "el 401 incluye WWW-Authenticate con resource_metadata",
    "resource_metadata" in cab.get("WWW-Authenticate", ""),
    cab.get("WWW-Authenticate", "(ausente)"),
)

codigo, _, cuerpo = pedir("GET", f"{BASE}/.well-known/oauth-protected-resource")
comprobar("metadatos del recurso protegido", codigo == 200, cuerpo)
recurso = json.loads(cuerpo) if codigo == 200 else {}
comprobar("declara authorization_servers", bool(recurso.get("authorization_servers")), cuerpo)

codigo, _, cuerpo = pedir("GET", f"{BASE}/.well-known/oauth-authorization-server")
comprobar("metadatos del servidor de autorizacion", codigo == 200, cuerpo)
meta = json.loads(cuerpo) if codigo == 200 else {}
for clave in ("issuer", "authorization_endpoint", "token_endpoint", "registration_endpoint"):
    comprobar(f"metadatos: {clave}", clave in meta, cuerpo)
comprobar("soporta PKCE S256", "S256" in meta.get("code_challenge_methods_supported", []), cuerpo)

# 2. Registro dinamico: claude.ai se da de alta solo.
print("\n2. Registro dinamico de cliente")
REDIR = "https://claude.ai/api/mcp/auth_callback"
codigo, _, cuerpo = pedir("POST", meta.get("registration_endpoint", f"{BASE}/register"),
                          {"redirect_uris": [REDIR], "client_name": "Claude"})
comprobar("POST /register devuelve 201", codigo == 201, cuerpo)
reg = json.loads(cuerpo) if codigo == 201 else {}
comprobar("entrega un client_id", bool(reg.get("client_id")), cuerpo)

# 3. Autorizacion con PKCE.
print("\n3. Autorizacion con PKCE")
verificador = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
reto = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b"=").decode()
consulta = urllib.parse.urlencode({
    "response_type": "code",
    "client_id": reg.get("client_id", ""),
    "redirect_uri": REDIR,
    "code_challenge": reto,
    "code_challenge_method": "S256",
    "state": "estado-de-prueba",
    "scope": "terminal",
})
codigo, cab, _ = pedir("GET", f"{meta.get('authorization_endpoint')}?{consulta}", seguir=False)
comprobar("GET /authorize redirige (302)", codigo == 302, f"llego {codigo}")
destino = cab.get("Location", "")
params = urllib.parse.parse_qs(urllib.parse.urlparse(destino).query)
comprobar("redirige al redirect_uri registrado", destino.startswith(REDIR), destino)
comprobar("devuelve un code", bool(params.get("code")), destino)
comprobar("conserva el state", params.get("state", [None])[0] == "estado-de-prueba", destino)
autorizacion = params.get("code", [""])[0]

# 4. Canje del codigo.
print("\n4. Canje del codigo por token")
codigo_http, _, cuerpo = pedir("POST", meta.get("token_endpoint"), {
    "grant_type": "authorization_code",
    "code": autorizacion,
    "redirect_uri": REDIR,
    "client_id": reg.get("client_id", ""),
    "code_verifier": verificador,
})
comprobar("POST /token devuelve 200", codigo_http == 200, cuerpo)
tok = json.loads(cuerpo) if codigo_http == 200 else {}
acceso = tok.get("access_token", "")
comprobar("entrega un access_token", bool(acceso), cuerpo)
comprobar("token_type es Bearer", tok.get("token_type") == "Bearer", cuerpo)

# El mismo codigo no debe poder canjearse dos veces.
codigo_http, _, cuerpo = pedir("POST", meta.get("token_endpoint"), {
    "grant_type": "authorization_code",
    "code": autorizacion,
    "redirect_uri": REDIR,
    "code_verifier": verificador,
})
comprobar("reusar el codigo se rechaza", codigo_http == 400, f"llego {codigo_http}")

# PKCE incorrecto tambien.
consulta2 = urllib.parse.urlencode({
    "response_type": "code", "client_id": reg.get("client_id", ""), "redirect_uri": REDIR,
    "code_challenge": reto, "code_challenge_method": "S256",
})
_, cab2, _ = pedir("GET", f"{meta.get('authorization_endpoint')}?{consulta2}", seguir=False)
codigo2 = urllib.parse.parse_qs(urllib.parse.urlparse(cab2.get("Location", "")).query).get("code", [""])[0]
codigo_http, _, cuerpo = pedir("POST", meta.get("token_endpoint"), {
    "grant_type": "authorization_code", "code": codigo2,
    "redirect_uri": REDIR, "code_verifier": "verificador-equivocado",
})
comprobar("PKCE incorrecto se rechaza", codigo_http == 400, f"llego {codigo_http}: {cuerpo[:120]}")

# 5. Uso real del token.
print("\n5. Llamada MCP con el token emitido")
cab_auth = {"Authorization": f"Bearer {acceso}"}
codigo_http, _, cuerpo = pedir("POST", f"{BASE}/mcp",
                               {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, cab_auth)
comprobar("tools/list autenticado", codigo_http == 200 and "run_command" in cuerpo, cuerpo[:200])

codigo_http, _, cuerpo = pedir("POST", f"{BASE}/mcp", {
    "jsonrpc": "2.0", "id": 2, "method": "tools/call",
    "params": {"name": "run_command", "arguments": {"command": "echo oauth-funciona"}},
}, cab_auth)
comprobar("run_command autenticado", "oauth-funciona" in cuerpo, cuerpo[:200])

codigo_http, _, _ = pedir("POST", f"{BASE}/mcp",
                          {"jsonrpc": "2.0", "id": 3, "method": "ping"},
                          {"Authorization": "Bearer at_inventado_que_no_existe"})
comprobar("token inventado se rechaza", codigo_http == 401, f"llego {codigo_http}")

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallo(s): {', '.join(fallos)}")
    sys.exit(1)
print("RESULTADO: todo correcto")
