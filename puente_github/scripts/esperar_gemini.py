#!/usr/bin/env python3
"""Sondea el router hasta que el job de las mejoras M1/M2/M3 termine.

Un solo pedido del puente en vez de una ronda cada 30 s. Se rinde a los
540 s para no chocar con el limite de 600 s del ejecutor de scripts.
"""
import json
import socket
import time

SOCKET = "/run/jean-flow-router.sock"
JOB = "jfr-5226a7e9204cbe09170d86ae3714efacdf1a61fe"
LIMITE_S = 540
INTERVALO_S = 15


def rpc(method, payload):
    s = socket.socket(socket.AF_UNIX)
    s.settimeout(30)
    s.connect(SOCKET)
    s.sendall(json.dumps({"method": method, "payload": payload}).encode() + b"\n")
    s.shutdown(socket.SHUT_WR)
    try:
        return json.loads(s.makefile().readline())
    finally:
        s.close()


def main():
    inicio = time.monotonic()
    ultimo = None
    while time.monotonic() - inicio < LIMITE_S:
        r = rpc("result", {"id": JOB})
        estado = r.get("status")
        if estado != ultimo:
            print("t=%4ds status=%s updated_at=%s"
                  % (time.monotonic() - inicio, estado, r.get("updated_at")),
                  flush=True)
            ultimo = estado
        if estado not in ("running", "pending", "queued"):
            print("=== RESULTADO FINAL ===")
            print(json.dumps(r, ensure_ascii=False, indent=2)[:12000])
            return
        time.sleep(INTERVALO_S)
    print("SIN_DESENLACE_EN_%ds status=%s" % (LIMITE_S, ultimo))


if __name__ == "__main__":
    main()
