#!/usr/bin/env python3
"""Tabla normalizada de la cola de event_loop_lag en todos los gates.

Corrige dos errores del intento anterior:
  - los ficheros cubren duraciones muy distintas (18 min a 60 min), asi que
    el 'maximo' no es comparable: se normaliza por hora de exposicion
  - hay ficheros de metricas rotados o parciales: se declara la cobertura real
"""
import json, os, glob, statistics
from datetime import datetime
from collections import defaultdict

BASE = "/home/trading/jean-flow-exec/staging_runs"
UMBRALES = (20.0, 100.0, 400.0)


def publicaciones(ruta):
    with open(ruta) as fh:
        for linea in fh:
            try:
                d = json.loads(linea)
            except Exception:
                continue
            m = d.get("message", "")
            if not m.startswith("metrics market="):
                continue
            resto = m[len("metrics market="):]
            mercado, _, cuerpo = resto.partition(" ")
            try:
                yield d["timestamp"], mercado, json.loads(cuerpo)
            except Exception:
                continue


def clave_lag(doc):
    lat = doc.get("latency_ms", {})
    if "event_loop_lag" in lat:
        return "event_loop_lag"
    for k in lat:
        if "lag" in k and "diagnostic" not in k:
            return k
    for k in lat:
        if "lag" in k:
            return k
    return None


def commit(gate):
    for p in ("evidence/source_commit.txt", "overlay/PROVENANCE.md"):
        f = os.path.join(BASE, gate, p)
        if os.path.isfile(f):
            t = open(f, errors="replace").read().strip().split("\n")[0]
            return t[:12]
    return "?"


filas = []
for gate in sorted(os.listdir(BASE)):
    f = os.path.join(BASE, gate, "capture", "jean_flow_metrics.jsonl")
    if not os.path.isfile(f) or os.path.getsize(f) < 5000:
        continue
    por_mercado = defaultdict(list)
    ts_todos = []
    clave = None
    for ts, mercado, doc in publicaciones(f):
        if clave is None:
            clave = clave_lag(doc)
        m = doc.get("latency_ms", {}).get(clave) if clave else None
        if m and m.get("max") is not None:
            por_mercado[mercado].append((ts, m.get("evicted", 0), m["max"]))
            ts_todos.append(ts)
    if not ts_todos:
        continue
    a = datetime.fromisoformat(min(ts_todos))
    b = datetime.fromisoformat(max(ts_todos))
    horas = (b - a).total_seconds() / 3600.0
    if horas <= 0:
        continue

    for mercado in sorted(por_mercado):
        v = por_mercado[mercado]
        maduras = [x for x in v if x[1] > 0]
        maxs = [x[2] for x in maduras]
        if not maxs:
            continue
        fila = {
            "gate": gate,
            "commit": commit(gate),
            "mercado": mercado,
            "horas": horas,
            "vent_total": len(v),
            "vent_maduras": len(maduras),
            "mediana": statistics.median(maxs),
            "p95": sorted(maxs)[min(len(maxs) - 1, int(0.95 * len(maxs)))],
            "max": max(maxs),
        }
        for u in UMBRALES:
            n = sum(1 for x in maxs if x > u)
            fila[f"n>{u:.0f}"] = n
            fila[f"hora>{u:.0f}"] = n / horas
        filas.append(fila)

cab = (f"{'gate':46s} {'commit':13s} {'mercado':13s} {'horas':>6s} {'madur':>6s} "
       f"{'medi':>8s} {'p95':>8s} {'max':>9s} {'>20/h':>8s} {'>100/h':>8s} {'>400/h':>7s}")
print(cab)
print("-" * len(cab))
for r in filas:
    print(f"{r['gate'][:46]:46s} {r['commit']:13s} {r['mercado']:13s} "
          f"{r['horas']:6.2f} {r['vent_maduras']:6d} "
          f"{r['mediana']:8.2f} {r['p95']:8.2f} {r['max']:9.2f} "
          f"{r['hora>20']:8.1f} {r['hora>100']:8.1f} {r['hora>400']:7.2f}")
