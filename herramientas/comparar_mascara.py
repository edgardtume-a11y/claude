#!/usr/bin/env python3
"""Compara la cola de event loop lag antes y despues del enmascaramiento.

Uso: comparar_mascara.py <etiqueta>=<ruta_metrics.jsonl> [...]

Publica, por gate y mercado:
  - ventanas totales y maduras (evicted>0: la ventana rodante ya desborda)
  - distribucion del 'max' publicado en ventanas maduras
  - excedencias por encima de 20 y 100 ms
  - lo que diga la instrumentacion nueva event_loop_lag_exceedances
"""
import json, sys, statistics
from collections import defaultdict

CLAVE = "event_loop_lag"          # se resuelve al nombre real presente
ALTERNATIVAS = [
    "event_loop_lag",
    "event_loop_lag_loop_clock_diagnostic",
    "event_loop_lag_perf_counter",
]


def bloques(ruta):
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


def resolver_clave(ruta):
    for _, _, doc in bloques(ruta):
        lat = doc.get("latency_ms", {})
        for c in ALTERNATIVAS:
            if c in lat:
                return c
        # si no, el primero que mencione lag
        for k in lat:
            if "lag" in k:
                return k
        return None
    return None


def analizar(etiqueta, ruta):
    clave = resolver_clave(ruta)
    print(f"\n{'='*72}\n{etiqueta}\n  fichero: {ruta}\n  metrica: {clave}")
    if not clave:
        print("  SIN metrica de lag. Nada que comparar.")
        return

    por_mercado = defaultdict(list)
    exced = defaultdict(lambda: {"total": 0, "emitted": 0, "dropped": 0, "eventos": []})

    for ts, mercado, doc in bloques(ruta):
        m = doc.get("latency_ms", {}).get(clave)
        if m:
            por_mercado[mercado].append({
                "ts": ts,
                "count": m.get("count", 0),
                "evicted": m.get("evicted", 0),
                "p50": m.get("p50"), "p95": m.get("p95"),
                "p99": m.get("p99"), "max": m.get("max"),
            })
        ex = doc.get("event_loop_lag_exceedances")
        if isinstance(ex, dict):
            e = exced[mercado]
            e["total"] = max(e["total"], ex.get("total", 0))
            e["emitted"] = max(e["emitted"], ex.get("emitted", 0))
            e["dropped"] = max(e["dropped"], ex.get("dropped", 0))
            for ev in ex.get("events", []) or []:
                e["eventos"].append(ev)

    for mercado in sorted(por_mercado):
        v = por_mercado[mercado]
        maduras = [x for x in v if x["evicted"] > 0]
        maxs = [x["max"] for x in maduras if x["max"] is not None]
        print(f"\n  --- {mercado} ---")
        print(f"    ventanas publicadas : {len(v)}")
        print(f"    ventanas maduras    : {len(maduras)}  (evicted>0)")
        if not maxs:
            print("    sin ventanas maduras: gate demasiado corto para la ventana rodante")
            # aun asi, ensena el maximo global
            todos = [x["max"] for x in v if x["max"] is not None]
            if todos:
                print(f"    max global (todas)  : {max(todos):.3f} ms")
            continue
        maxs_ord = sorted(maxs)
        n = len(maxs_ord)
        p = lambda q: maxs_ord[min(n - 1, int(q * n))]
        print(f"    max publicado -> mediana {statistics.median(maxs):.3f} | "
              f"p95 {p(0.95):.3f} | maximo {max(maxs):.3f} ms")
        print(f"    ventanas con max > 20 ms  : {sum(1 for x in maxs if x > 20)}"
              f"  ({100*sum(1 for x in maxs if x>20)/n:.1f}%)")
        print(f"    ventanas con max > 100 ms : {sum(1 for x in maxs if x > 100)}"
              f"  ({100*sum(1 for x in maxs if x>100)/n:.1f}%)")
        if exced[mercado]["total"]:
            e = exced[mercado]
            print(f"    excedencias instrumentadas: total {e['total']} "
                  f"emitidas {e['emitted']} descartadas {e['dropped']}")
            picos = sorted((ev.get("lag_ms", 0) for ev in e["eventos"]), reverse=True)[:5]
            if picos:
                print(f"    mayores lag_ms: {', '.join(f'{x:.3f}' for x in picos)}")


for arg in sys.argv[1:]:
    etiqueta, _, ruta = arg.partition("=")
    try:
        analizar(etiqueta, ruta)
    except FileNotFoundError:
        print(f"\n{etiqueta}: NO EXISTE {ruta}")
