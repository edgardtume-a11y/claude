#!/usr/bin/env python3
"""Guardian del puente GitHub de JEAN FLOW (v1).

Revisa el repositorio cada POLL_SECONDS. Procesa ordenes JSON nuevas de
puente_github/ordenes/ y publica resultados en puente_github/resultados/.

Acciones permitidas (lista cerrada; nada de shell arbitrario):
  - gemini_enqueue: {"id", "accion", "prompt", "idempotency_key"}
      -> entrega al router idempotente por su socket local
  - gemini_result:  {"id", "accion", "job_id"}
      -> consulta el estado/resultado de un job del router
  - estado:         {"id", "accion"}
      -> salud basica de la maquina (cpu, disco, captura activa)

Una orden se procesa una sola vez: si existe resultados/<id>.json se ignora.
El id debe cumplir ^[a-z0-9][a-z0-9-]{3,63}$.
"""
import json
import os
import re
import socket
import subprocess
import time

REPO_DIR = "/home/trading/puente_github_repo"
BRANCH = "claude/google-cloud-remote-commander-pjqhc3"
ORDERS_DIR = os.path.join(REPO_DIR, "puente_github", "ordenes")
RESULTS_DIR = os.path.join(REPO_DIR, "puente_github", "resultados")
ROUTER_SOCKET = "/run/jean-flow-router.sock"
PAT_FILE = "/home/trading/.config/puente-github/pat"
REPO_SLUG = "edgardtume-a11y/claude"
POLL_SECONDS = 30
MAX_ORDER_BYTES = 64 * 1024
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{3,63}$")


def sh(args, cwd=None, timeout=120):
    return subprocess.run(args, cwd=cwd, timeout=timeout,
                          capture_output=True, text=True)


def pat():
    with open(PAT_FILE) as fh:
        return fh.read().strip()


def authed_url():
    return "https://x-access-token:%s@github.com/%s.git" % (pat(), REPO_SLUG)


def router_rpc(method, payload):
    s = socket.socket(socket.AF_UNIX)
    s.settimeout(30)
    s.connect(ROUTER_SOCKET)
    s.sendall(json.dumps({"method": method, "payload": payload}).encode() + b"\n")
    s.shutdown(socket.SHUT_WR)
    return json.loads(s.makefile().readline())


def do_estado(_order):
    load = open("/proc/loadavg").read().split()[0]
    disk = sh(["df", "-h", "/home"]).stdout.strip().splitlines()[-1]
    cap = sh(["pgrep", "-fc", "binance_collector[.]dual_main"]).stdout.strip() or "0"
    return {"nproc": os.cpu_count(), "load1": load,
            "disco": disk, "capturas_activas": cap}


def process(order):
    accion = order.get("accion")
    if accion == "gemini_enqueue":
        prompt = order.get("prompt")
        key = order.get("idempotency_key")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("prompt obligatorio")
        payload = {"prompt": prompt}
        if key is not None:
            payload["idempotency_key"] = key
        return router_rpc("enqueue", payload)
    if accion == "gemini_result":
        return router_rpc("result", {"id": order.get("job_id")})
    if accion == "estado":
        return do_estado(order)
    raise ValueError("accion no permitida: %r" % accion)


def sync_repo():
    if not os.path.isdir(REPO_DIR):
        sh(["git", "clone", "--branch", BRANCH, "--single-branch",
            "https://github.com/%s.git" % REPO_SLUG, REPO_DIR], timeout=300)
    sh(["git", "fetch", "origin", BRANCH], cwd=REPO_DIR)
    sh(["git", "checkout", BRANCH], cwd=REPO_DIR)
    sh(["git", "reset", "--hard", "origin/%s" % BRANCH], cwd=REPO_DIR)


def push_result(order_id, result_obj):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, order_id + ".json")
    with open(path, "w") as fh:
        json.dump(result_obj, fh, ensure_ascii=False, indent=2, sort_keys=True)
    sh(["git", "add", path], cwd=REPO_DIR)
    sh(["git", "-c", "user.name=puente-tokio", "-c",
        "user.email=puente@jean-flow.local", "commit", "-m",
        "puente: resultado " + order_id], cwd=REPO_DIR)
    for _ in range(3):
        sh(["git", "pull", "--rebase", "origin", BRANCH], cwd=REPO_DIR)
        r = sh(["git", "push", authed_url(), "HEAD:%s" % BRANCH], cwd=REPO_DIR)
        if r.returncode == 0:
            return True
        time.sleep(5)
    return False


def scan_once():
    sync_repo()
    if not os.path.isdir(ORDERS_DIR):
        return
    for name in sorted(os.listdir(ORDERS_DIR)):
        if not name.endswith(".json"):
            continue
        order_id = name[:-5]
        if not ID_RE.fullmatch(order_id):
            continue
        if os.path.exists(os.path.join(RESULTS_DIR, order_id + ".json")):
            continue
        opath = os.path.join(ORDERS_DIR, name)
        if os.path.getsize(opath) > MAX_ORDER_BYTES:
            push_result(order_id, {"ok": False, "error": "orden demasiado grande"})
            continue
        try:
            order = json.load(open(opath))
            if order.get("id") != order_id:
                raise ValueError("id del JSON no coincide con el nombre del archivo")
            result = process(order)
            out = {"ok": True, "id": order_id, "resultado": result}
        except Exception as exc:  # noqa: BLE001 - se reporta, nunca se oculta
            out = {"ok": False, "id": order_id, "error": str(exc)}
        out["procesado_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        push_result(order_id, out)


def main():
    while True:
        try:
            scan_once()
        except Exception as exc:  # noqa: BLE001
            print("ciclo con error:", exc, flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
