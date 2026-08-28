#!/usr/bin/env python3
"""El lag REAL de un gate, con el instrumento correcto.

latency_ms.event_loop_lag  = ventana RODANTE de 10000 muestras (~200 s).
  Su 'max' es un estadistico extremo sobre una ventana que se solapa un 97.5%
  entre publicaciones. La mediana de ese max NO es la mediana del lag.

latency_interval_ms.event_loop_lag = ventana de 5 s NO SOLAPADA.
  Cada publicacion es una muestra independiente. Esto si se puede agregar.

Este script agrega las ventanas no solapadas y da la distribucion de verdad.
Solo existe en gates desde el commit c93b6de en adelante.
"""
import json, sys, statistics
from collections import defaultdict

RUTA = sys.argv[1]


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
                yield mercado, json.loads(cuerpo)
            except Exception:
                continue


datos = defaultdict(lambda: {"p50": [], "p99": [], "max": [], "n": 0,
                             "muestras": 0, "dropped": 0, "incompletas": 0,
                             "exc_total": [], "exc_dropped": []})

for mercado, doc in bloques(RUTA):
    iv = doc.get("latency_interval_ms", {}).get("event_loop_lag")
    if iv:
        d = datos[mercado]
        d["n"] += 1
        d["muestras"] += iv.get("sample_count", 0)
        d["dropped"] += iv.get("dropped", 0)
        if not iv.get("complete", True):
            d["incompletas"] += 1
        for k in ("p50", "p99", "max"):
            if iv.get(k) is not None:
                d[k].append(iv[k])
    ex = doc.get("event_loop_lag_exceedances")
    if isinstance(ex, dict):
        datos[mercado]["exc_total"].append(ex.get("total", 0))
        datos[mercado]["exc_dropped"].append(ex.get("dropped", 0))


def pct(v, q):
    v = sorted(v)
    return v[min(len(v) - 1, int(q * len(v)))]


for mercado in sorted(datos):
    d = datos[mercado]
    print(f"\n=== {mercado} — ventanas de 5 s NO SOLAPADAS ===")
    print(f"  ventanas          : {d['n']}   ({d['n']*5/60:.1f} min de cobertura)")
    print(f"  muestras de lag   : {d['muestras']:,}   descartadas: {d['dropped']}")
    print(f"  ventanas incompletas: {d['incompletas']}")
    if not d["max"]:
        continue
    print()
    print(f"  {'':10s} {'mediana':>9s} {'p95':>9s} {'p99':>9s} {'maximo':>9s}")
    for k in ("p50", "p99", "max"):
        v = d[k]
        print(f"  {k+' por vent.':14s} {statistics.median(v):9.3f} "
              f"{pct(v,0.95):9.3f} {pct(v,0.99):9.3f} {max(v):9.3f}")
    print()
    peor = sorted(d["max"], reverse=True)[:8]
    print(f"  8 peores ventanas (max, ms): {', '.join(f'{x:.2f}' for x in peor)}")
    n20 = sum(1 for x in d["max"] if x > 20)
    n100 = sum(1 for x in d["max"] if x > 100)
    print(f"  ventanas con max > 20 ms  : {n20} de {d['n']}  ({100*n20/d['n']:.2f}%)")
    print(f"  ventanas con max > 100 ms : {n100} de {d['n']}  ({100*n100/d['n']:.2f}%)")
    if d["exc_total"]:
        print(f"  excedencias >20ms: ultimo total publicado {d['exc_total'][-1]}, "
              f"maximo visto {max(d['exc_total'])}, descartadas {max(d['exc_dropped'])}")
