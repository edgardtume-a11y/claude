#!/usr/bin/env python3
"""Extrae la linea base interna del gate 3 para poder comparar el A/B.

Saca latency_ms_from_journal_headers de los dos mercados y, si existe,
las metricas del bucle de eventos de audit/metrics.json.
"""
import json
import os

G3 = ("/home/trading/jean-flow-exec/staging_runs/"
      "20260827T143004Z_tokyo_n2_capture_gate3_2h")
AUDIT = os.path.join(G3, "audit")


def cargar(nombre):
    ruta = os.path.join(AUDIT, nombre)
    if not os.path.isfile(ruta) or os.path.getsize(ruta) == 0:
        return None
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


print("=== latencia por cabeceras del journal ===")
for mercado, fichero in (("spot", "journal_spot.json"),
                         ("usdm", "journal_usdm.json")):
    d = cargar(fichero)
    if not d:
        print(f"{mercado}: (sin datos)")
        continue
    print(f"--- {mercado} ---")
    print(json.dumps(d.get("latency_ms_from_journal_headers", {}),
                     ensure_ascii=False, indent=2, sort_keys=True))
    print("replay:", json.dumps(d.get("replay", {}), ensure_ascii=False)[:400])
    print("incompletos:", json.dumps(d.get("incomplete_markers", {}),
                                     ensure_ascii=False)[:300])

print()
print("=== metrics.json (bucle de eventos) ===")
m = cargar("metrics.json")
print(json.dumps(m, ensure_ascii=False, indent=2, sort_keys=True)[:2500]
      if m else "(vacio o aun no generado)")

print()
print("=== identity.json ===")
i = cargar("identity.json")
if i:
    print(json.dumps(i, ensure_ascii=False, indent=2, sort_keys=True)[:1500])
else:
    print("(vacio o aun no generado)")

print()
print("=== return_codes.json ===")
print(json.dumps(cargar("return_codes.json"), ensure_ascii=False))
print("METRICAS_BASE_OK")
