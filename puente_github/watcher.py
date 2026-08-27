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
  - auditar_staging: {"id", "accion", "staging"}
      -> lanza control/run_live_audits.sh en segundo plano (solo bajo staging_runs/)
  - leer_archivo:   {"id", "accion", "ruta"}
      -> lee un archivo (max 100 KB) SOLO bajo staging_runs/ (.json/.log/.txt)
  - latencia_e2e:   {"id", "accion", "staging"}
      -> calcula n/min/p50/p90/p99 del CSV mas grande de capture/ (ultimos 8 MB)

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
MAX_READ_BYTES = 100 * 1024
STAGING_PREFIX = "/home/trading/jean-flow-exec/staging_runs/"
VENV_PY = "/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python"
SCRIPTS_DIR = os.path.join(REPO_DIR, "puente_github", "scripts")
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


def valid_staging(path):
    real = os.path.realpath(path)
    if not real.startswith(STAGING_PREFIX) or not os.path.isdir(real):
        raise ValueError("staging invalido o inexistente")
    return real


def do_auditar(order):
    root = valid_staging(order.get("staging", ""))
    script = os.path.join(root, "control", "run_live_audits.sh")
    if not os.path.isfile(script):
        raise ValueError("falta control/run_live_audits.sh")
    log = os.path.join(root, "audit", "puente_audit.log")
    os.makedirs(os.path.dirname(log), exist_ok=True)
    subprocess.Popen(
        ["nohup", "bash", script],
        cwd=root, stdout=open(log, "w"), stderr=subprocess.STDOUT,
        start_new_session=True)
    return {"lanzado": True, "log": log}


def do_leer(order):
    ruta = os.path.realpath(str(order.get("ruta", "")))
    if not ruta.startswith(STAGING_PREFIX):
        raise ValueError("ruta fuera de staging_runs")
    if not ruta.endswith((".json", ".log", ".txt")):
        raise ValueError("solo .json/.log/.txt")
    if not os.path.isfile(ruta):
        return {"existe": False}
    with open(ruta, "rb") as fh:
        data = fh.read(MAX_READ_BYTES)
    return {"existe": True, "bytes": os.path.getsize(ruta),
            "contenido": data.decode("utf-8", "ignore")}


def do_latencia(order):
    import glob
    root = valid_staging(order.get("staging", ""))
    fs = glob.glob(os.path.join(root, "capture", "**", "*.csv"), recursive=True)
    if not fs:
        raise ValueError("sin CSV en capture/")
    f = max(fs, key=os.path.getsize)
    size = os.path.getsize(f)
    with open(f, "rb") as fh:
        head = fh.readline().decode().strip().split(",")
        fh.seek(max(0, size - 8 * 1024 * 1024))
        lines = fh.read().decode("utf-8", "ignore").splitlines()
    i_ev = head.index("exchange_event_time_ms")
    i_rx = head.index("receive_time_utc_ns")
    lat = []
    for ln in lines[1:]:
        p = ln.split(",")
        if len(p) > max(i_ev, i_rx) and p[i_ev] and p[i_rx]:
            try:
                lat.append(int(p[i_rx]) / 1e6 - int(p[i_ev]))
            except ValueError:
                pass
    lat.sort()
    n = len(lat)
    if not n:
        raise ValueError("sin muestras validas")
    return {"archivo": os.path.basename(f), "n": n,
            "min_ms": round(lat[0], 2), "p50_ms": round(lat[n // 2], 2),
            "p90_ms": round(lat[int(n * 0.9)], 2),
            "p99_ms": round(lat[int(n * 0.99)], 2)}


def do_revisar(order):
    root = valid_staging(order.get("staging", ""))
    env = dict(os.environ, PYTHONPATH="overlay/src")
    r = subprocess.run([VENV_PY, "-m", "pytest", "overlay/tests", "-q"],
                       cwd=root, env=env, capture_output=True, text=True,
                       timeout=300)
    salida = (r.stdout + r.stderr)[-4000:]
    return {"returncode": r.returncode, "salida": salida}


def do_lanzar(order):
    root = valid_staging(order.get("staging", ""))
    guard = subprocess.run(["pgrep", "-f", "binance_collector[.]dual_main"],
                           capture_output=True)
    if guard.returncode == 0:
        raise ValueError("YA HAY UNA CAPTURA ACTIVA - lanzamiento abortado")
    script = os.path.join(root, "control", "launch_live.sh")
    if not os.path.isfile(script):
        raise ValueError("falta control/launch_live.sh")
    log = os.path.join(root, "launcher_console.log")
    subprocess.Popen(["nohup", "bash", script], cwd=root,
                     stdout=open(log, "w"), stderr=subprocess.STDOUT,
                     start_new_session=True)
    time.sleep(8)
    tail = open(log).read()[-1500:] if os.path.exists(log) else ""
    return {"lanzado": True, "log": log, "inicio": tail}


def do_script_repo(order):
    nombre = str(order.get("script", ""))
    if not re.fullmatch(r"[a-z0-9_-]+\.(sh|py)", nombre):
        raise ValueError("nombre de script invalido")
    path = os.path.realpath(os.path.join(SCRIPTS_DIR, nombre))
    if not path.startswith(os.path.realpath(SCRIPTS_DIR) + os.sep) \
            or not os.path.isfile(path):
        raise ValueError("script inexistente en puente_github/scripts/")
    runner = ["bash", path] if nombre.endswith(".sh") else [VENV_PY, path]
    r = subprocess.run(runner, cwd="/home/trading", capture_output=True,
                       text=True, timeout=600)
    return {"returncode": r.returncode,
            "salida": (r.stdout + r.stderr)[-4000:]}


def process(order):
    accion = order.get("accion")
    if accion == "revisar_staging":
        return do_revisar(order)
    if accion == "lanzar_captura":
        return do_lanzar(order)
    if accion == "ejecutar_script_repo":
        return do_script_repo(order)
    if accion == "auditar_staging":
        return do_auditar(order)
    if accion == "leer_archivo":
        return do_leer(order)
    if accion == "latencia_e2e":
        return do_latencia(order)
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
