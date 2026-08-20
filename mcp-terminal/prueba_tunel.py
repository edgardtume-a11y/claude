#!/usr/bin/env python3
"""Comprueba que el servidor construye sus URLs con el dominio publico.

Detras de un tunel, el cliente ve un dominio HTTPS pero el servidor escucha en
loopback. Si el 'issuer' o los endpoints salieran como 127.0.0.1, el cliente
rechazaria el flujo. Aqui se simulan las cabeceras que inyecta el tunel.

Uso:  python3 prueba_tunel.py [base] [dominio-publico]
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8791"
PUBLICO = sys.argv[2] if len(sys.argv) > 2 else "standings-suited-terminal-mag.trycloudflare.com"
ESPERADA = f"https://{PUBLICO}"

CABECERAS = {"X-Forwarded-Proto": "https", "X-Forwarded-Host": PUBLICO}
fallos = []


def pedir(metodo, ruta, cuerpo=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    cab = dict(CABECERAS)
    if datos:
        cab["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + ruta, data=datos, headers=cab, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def comprobar(nombre, condicion, detalle=""):
    print(f"  {'OK  ' if condicion else 'FALLO'}  {nombre}")
    if not condicion:
        fallos.append(nombre)
        if detalle:
            print(f"         {detalle[:200]}")


print(f"Simulando el tunel {ESPERADA}\n")

_, _, cuerpo = pedir("GET", "/.well-known/oauth-authorization-server")
meta = json.loads(cuerpo)
print("  metadatos del servidor de autorizacion:")
for clave in ("issuer", "authorization_endpoint", "token_endpoint", "registration_endpoint"):
    print(f"    {clave:26} {meta.get(clave)}")
print()

comprobar("issuer usa el dominio publico", meta.get("issuer") == ESPERADA, meta.get("issuer"))
for clave in ("authorization_endpoint", "token_endpoint", "registration_endpoint"):
    comprobar(f"{clave} usa https del tunel",
              str(meta.get(clave, "")).startswith(ESPERADA), meta.get(clave))
comprobar("ningun endpoint apunta a loopback",
          "127.0.0.1" not in cuerpo and "localhost" not in cuerpo, cuerpo)

_, _, cuerpo = pedir("GET", "/.well-known/oauth-protected-resource")
recurso = json.loads(cuerpo)
print(f"\n  recurso protegido: {recurso.get('resource')}")
comprobar("resource apunta al /mcp publico", recurso.get("resource") == ESPERADA + "/mcp", cuerpo)
comprobar("authorization_servers apunta al publico",
          recurso.get("authorization_servers") == [ESPERADA], cuerpo)

codigo, cab, _ = pedir("POST", "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
autenticar = cab.get("WWW-Authenticate", "")
print(f"\n  WWW-Authenticate: {autenticar}")
comprobar("el 401 apunta al metadata publico", ESPERADA in autenticar, autenticar)

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallo(s): {', '.join(fallos)}")
    sys.exit(1)
print("RESULTADO: todo correcto")
