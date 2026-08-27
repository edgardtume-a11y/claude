#!/usr/bin/env python3
"""Linea base del gate 3 por ventanas de 30 min, version 3.

Las dos versiones anteriores fallaron por suponer la forma del fichero en vez
de mirarla. Las metricas viven anidadas: cada linea es un registro de log cuyo
campo "message" es el texto 'metrics market=<mercado> {json}'. Los p99 estan
dentro de ese json interno. Esta version lo desanida y se autodescubre.
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
CABECERA = re.compile(r"^metrics market=(\S+)\s+(\{.*\})\s*$", re.S)


def desanidar(linea):
    """Devuelve (instante, mercado, metricas) o None si la linea no sirve."""
    try:
        reg = json.loads(linea)
    except ValueError:
        return None
    mensaje = reg.get("message")
    if not isinstance(mensaje, str):
        return None
    m = CABECERA.match(mensaje)
    if not m:
        return None
    try:
        cuerpo = json.loads(m.group(2))
    except ValueError:
        return None
    try:
        t = datetime.fromisoformat(reg["timestamp"]).timestamp()
    except (KeyError, ValueError, TypeError):
        return None
    return t, m.group(1), cuerpo


def buscar_p99(cuerpo, metrica):
    """Encuentra el p99 en ms de una metrica, mire donde mire su seccion."""
    for seccion in ("histograms", "timers", "latencies", "summaries", "gauges"):
        bloque = cuerpo.get(seccion)
        if not isinstance(bloque, dict):
            continue
        sub = bloque.get(metrica)
        if isinstance(sub, dict):
            for clave in ("p99_ms", "p99"):
                if isinstance(sub.get(clave), (int, float)):
                    return float(sub[clave])
        for clave, valor in bloque.items():
            if metrica in clave and "p99" in clave and isinstance(valor, (int, float)):
                return float(valor)
    return None


def main():
    print("fichero:", os.path.getsize(METRICAS), "bytes")

    # --- fase 1: mostrar donde estan realmente los p99 ---
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            d = desanidar(linea)
            if not d:
                continue
            _, mercado, cuerpo = d
            print("secciones del registro:", sorted(cuerpo.keys()))
            for seccion, bloque in cuerpo.items():
                if not isinstance(bloque, dict):
                    continue
                claves_p99 = [k for k in bloque if "p99" in k.lower()]
                nombres = [k for k in bloque if any(i in k for i in INTERES)]
                if claves_p99 or nombres:
                    print(f"  {seccion}: p99->{claves_p99[:6]} interes->{nombres[:6]}")
                    for k in nombres[:2]:
                        print(f"    ejemplo {k} = "
                              f"{json.dumps(bloque[k], ensure_ascii=False)[:200]}")
            break

    # --- fase 2: agrupar ---
    t0 = None
    tramos = defaultdict(lambda: defaultdict(float))
    vistos = 0
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            d = desanidar(linea)
            if not d:
                continue
            t, mercado, cuerpo = d
            if t0 is None:
                t0 = t
            idx = int((t - t0) // VENTANA_S)
            for metrica in INTERES:
                v = buscar_p99(cuerpo, metrica)
                if v is None:
                    continue
                vistos += 1
                clave = (mercado, metrica)
                if v > tramos[clave][idx]:
                    tramos[clave][idx] = v

    print("\nvalores de p99 encontrados:", vistos)
    if not vistos:
        print("VENTANAS_V3_SIN_DATOS")
        return

    print("\n=== peor p99 por tramo de 30 min (gate 3, SIN uvloop) ===")
    for (mercado, metrica), por_tramo in sorted(tramos.items()):
        vals = [v for _, v in sorted(por_tramo.items()) if v > 0]
        orden = sorted(vals)
        n = len(orden)
        print(f"\n{mercado}.{metrica}   ({n} tramos de 30 min, limite 5.0 ms)")
        print("  " + " ".join(f"{v:.2f}" for v in vals))
        print(f"  mejor={orden[0]:.3f}  mediana={orden[n // 2]:.3f}  peor={orden[-1]:.3f}")
        print(f"  tramos por encima de 5.0: {sum(1 for v in orden if v > 5.0)}/{n}")
    print("\nVENTANAS_V3_OK")


if __name__ == "__main__":
    main()
