#!/usr/bin/env python3
"""Del metrics.json del gate 3, saca SOLO lo que no pasa.

La auditoria de metricas devolvio 2. Aqui se busca, recursivamente, cada
comprobacion con pass=false, y se imprime su ruta y su contenido. Eso es la
linea base "antes" contra la que se medira uvloop.
"""
import json
import os

RUTA = ("/home/trading/jean-flow-exec/staging_runs/"
        "20260827T143004Z_tokyo_n2_capture_gate3_2h/audit/metrics.json")
ERR = RUTA.replace(".json", ".stderr")


def recorrer(nodo, camino=""):
    """Devuelve (camino, subarbol) de cada dict que tenga pass=False."""
    if isinstance(nodo, dict):
        if nodo.get("pass") is False:
            yield camino, nodo
        for clave, valor in nodo.items():
            yield from recorrer(valor, f"{camino}.{clave}" if camino else clave)
    elif isinstance(nodo, list):
        for i, valor in enumerate(nodo):
            yield from recorrer(valor, f"{camino}[{i}]")


def main():
    if os.path.getsize(ERR) > 0:
        print("=== stderr de la auditoria ===")
        with open(ERR, encoding="utf-8") as fh:
            print(fh.read()[:1500])
        print()

    with open(RUTA, encoding="utf-8") as fh:
        d = json.load(fh)

    print("=== veredicto global ===")
    for clave in ("certification", "pass", "verdict", "status", "gate"):
        if clave in d:
            print(f"{clave}: {json.dumps(d[clave], ensure_ascii=False)[:400]}")

    fallos = list(recorrer(d))
    print(f"\n=== comprobaciones que NO pasan: {len(fallos)} ===")
    for camino, nodo in fallos:
        print(f"\n--- {camino}")
        print(json.dumps(nodo, ensure_ascii=False, indent=2, sort_keys=True)[:900])

    print("\n=== latencias del bucle de eventos (los dos mercados) ===")
    for mercado, cuerpo in (d.get("markets") or {}).items():
        lat = cuerpo.get("latency_checks") or cuerpo.get("latencies") or {}
        for nombre, valor in lat.items():
            if isinstance(valor, dict):
                print(f"{mercado}.{nombre}: "
                      f"{json.dumps(valor, ensure_ascii=False, sort_keys=True)[:260]}")
    print("\nFALLOS_METRICS_OK")


if __name__ == "__main__":
    main()
