#!/usr/bin/env python3
"""Linea base del gate 3 por ventanas de 30 min, version 2.

La v1 fallo porque el jsonl no lleva timestamp_utc_ns sino "timestamp" en ISO,
y las metricas no estan en el nivel superior. Aqui primero se descubre la forma
real de los registros que contienen p99 y luego se agrupa por ventana.
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

G3 = ("/home/trading/jean-flow-exec/staging_runs/"
      "20260827T143004Z_tokyo_n2_capture_gate3_2h")
METRICAS = os.path.join(G3, "capture", "jean_flow_metrics.jsonl")
VENTANA_S = 30 * 60
INTERES = ("book_apply", "book_pipeline_total")


def instante(reg):
    ts = reg.get("timestamp")
    if not isinstance(ts, str):
        return None
    try:
        return datetime.fromisoformat(ts).timestamp()
    except ValueError:
        return None


def main():
    # --- fase 1: descubrir donde viven los p99 ---
    muestra = None
    con_p99 = 0
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            if "p99" not in linea:
                continue
            con_p99 += 1
            if muestra is None:
                muestra = linea
            if con_p99 >= 3:
                break
    print("lineas con p99 (primeras encontradas):", con_p99)
    if muestra is None:
        print("NINGUNA linea contiene p99; las metricas no estan en este fichero")
        print("VENTANAS_V2_SIN_DATOS")
        return
    print("muestra:", muestra[:1200])
    print()

    # --- fase 2: agrupar por ventana ---
    # Los valores llegan dentro del texto del mensaje o del propio JSON; se
    # extraen con una expresion regular sobre la linea completa, asociando cada
    # metrica de interes con el p99 en milisegundos que le sigue.
    patron = re.compile(
        r"(" + "|".join(INTERES) + r")[^\n]{0,120}?p99[_a-z]*[=\":\s]+([0-9.]+)")

    t0 = None
    tramos = defaultdict(lambda: defaultdict(float))
    total = 0
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            if "p99" not in linea:
                continue
            try:
                reg = json.loads(linea)
            except ValueError:
                continue
            t = instante(reg)
            if t is None:
                continue
            if t0 is None:
                t0 = t
            idx = int((t - t0) // VENTANA_S)
            for metrica, valor in patron.findall(linea):
                try:
                    v = float(valor)
                except ValueError:
                    continue
                total += 1
                if v > tramos[metrica][idx]:
                    tramos[metrica][idx] = v

    print("valores de p99 extraidos:", total)
    if not total:
        print("VENTANAS_V2_SIN_DATOS")
        return

    print()
    print("=== peor p99 por tramo de 30 min (gate 3, sin uvloop) ===")
    for metrica, por_tramo in sorted(tramos.items()):
        vals = [v for _, v in sorted(por_tramo.items()) if v > 0]
        orden = sorted(vals)
        n = len(orden)
        print(f"\n{metrica}  ({n} tramos)  limite=5.0 ms")
        print("  " + " ".join(f"{v:.3f}" for v in vals))
        print(f"  mejor={orden[0]:.3f}  mediana={orden[n // 2]:.3f}  peor={orden[-1]:.3f}")
        malos = sum(1 for v in orden if v > 5.0)
        print(f"  tramos por encima del limite: {malos}/{n}")
        print(f"  -> el gate 4 gana de verdad solo si baja de {orden[0]:.3f} ms")
    print("\nVENTANAS_V2_OK")


if __name__ == "__main__":
    main()
