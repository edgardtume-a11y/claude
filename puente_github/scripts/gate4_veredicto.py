#!/usr/bin/env python3
"""Veredicto formal de las auditorias del gate 4, con sus fallos si los hay."""
import json
import os

G4 = ("/home/trading/jean-flow-exec/staging_runs/"
      "20260827T195636Z_tokyo_n2_gate4_mejoras_30m")
AUDIT = os.path.join(G4, "audit")


def cargar(nombre):
    ruta = os.path.join(AUDIT, nombre)
    if not os.path.isfile(ruta) or not os.path.getsize(ruta):
        return None
    try:
        return json.load(open(ruta, encoding="utf-8"))
    except ValueError:
        return None


def fallos(nodo, camino=""):
    if isinstance(nodo, dict):
        if nodo.get("pass") is False:
            yield camino, nodo
        for k, v in nodo.items():
            yield from fallos(v, f"{camino}.{k}" if camino else k)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            yield from fallos(v, f"{camino}[{i}]")


rc = cargar("return_codes.json")
print("=== codigos de retorno ===")
print(json.dumps(rc, ensure_ascii=False) if rc else "(aun corriendo)")

for nombre in ("journal_spot.json", "journal_usdm.json"):
    d = cargar(nombre)
    if d:
        print(f"\n=== {nombre} ===")
        print("certification:", json.dumps(d.get("certification", {}),
                                           ensure_ascii=False)[:220])
        print("delta_dispositions:", json.dumps(d.get("delta_dispositions", {}),
                                                ensure_ascii=False))

d = cargar("identity.json")
if d:
    print("\n=== identity.json ===")
    print("certification:", d.get("certification"))
    print("completeness:", json.dumps(d.get("completeness", {}), ensure_ascii=False))
    print("conflictos:", d.get("conflict_count"), " errores:", len(d.get("errors", [])))

d = cargar("metrics.json")
if d:
    print("\n=== metrics.json ===")
    print("certification:", d.get("certification"))
    lista = list(fallos(d))
    print("comprobaciones que NO pasan:", len(lista))
    for camino, nodo in lista:
        print(f"\n--- {camino}")
        print(json.dumps(nodo, ensure_ascii=False, sort_keys=True, indent=2)[:700])

print("\nVEREDICTO_OK")
