#!/usr/bin/env python3
"""El "despues" del A/B: peor p99 por ventana de 30 min del gate 4 (con uvloop).

Mismo metodo exacto que la linea base del gate 3, para que la comparacion sea
entre iguales y no entre conveniencias.
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

G4 = ("/home/trading/jean-flow-exec/staging_runs/"
      "20260827T195636Z_tokyo_n2_gate4_mejoras_30m")
METRICAS = os.path.join(G4, "capture", "jean_flow_metrics.jsonl")
VENTANA_S = 30 * 60
INTERES = ("book_apply", "book_pipeline_total", "writer_cooperative_yield",
           "event_loop_lag")
CABECERA = re.compile(r"^metrics market=(\S+)\s+(\{.*\})\s*$", re.S)

# Linea base del gate 3, peor p99 por tramo de 30 min (ver
# operaciones/LINEA_BASE_AB_GATE4.md). mejor / mediana / peor.
BASE = {
    ("spot", "book_apply"): (1.400, 2.768, 3.561),
    ("spot", "book_pipeline_total"): (1.804, 3.200, 4.226),
    ("usdm_futures", "book_apply"): (3.185, 4.642, 6.282),
    ("usdm_futures", "book_pipeline_total"): (3.602, 5.192, 7.399),
}


def desanidar(linea):
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
        t = datetime.fromisoformat(reg["timestamp"]).timestamp()
    except (ValueError, KeyError, TypeError):
        return None
    return t, m.group(1), cuerpo


def main():
    t0 = None
    peor = defaultdict(float)      # (mercado, metrica) -> peor p99 del run
    ultimo = {}
    n = 0
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            d = desanidar(linea)
            if not d:
                continue
            t, mercado, cuerpo = d
            if t0 is None:
                t0 = t
            lat = cuerpo.get("latency_ms") or {}
            for metrica in INTERES:
                sub = lat.get(metrica)
                if not isinstance(sub, dict):
                    continue
                v = sub.get("p99")
                if not isinstance(v, (int, float)):
                    continue
                n += 1
                clave = (mercado, metrica)
                if v > peor[clave]:
                    peor[clave] = float(v)
                ultimo[clave] = (float(v), sub.get("p50"), sub.get("max"),
                                 sub.get("count_total"))

    print("muestras de p99 leidas:", n)
    if t0 is not None:
        print("duracion de la ventana: %.1f min" % ((t - t0) / 60.0))
    print()
    print("=== GATE 4 (CON uvloop + gc.freeze) contra la linea base ===")
    print()
    for clave in sorted(peor):
        mercado, metrica = clave
        v = peor[clave]
        ult = ultimo.get(clave, (None,) * 4)
        linea = f"{mercado}.{metrica}"
        print(f"{linea}")
        print(f"  peor p99 del gate 4 : {v:.3f} ms")
        print(f"  ultima ventana      : p50={ult[1]} p99={ult[0]} max={ult[2]} n={ult[3]}")
        if clave in BASE:
            mejor_b, med_b, peor_b = BASE[clave]
            print(f"  base gate 3         : mejor={mejor_b:.3f}  "
                  f"mediana={med_b:.3f}  peor={peor_b:.3f}")
            if v < mejor_b:
                print(f"  --> MEJOR QUE TODOS los tramos base "
                      f"({(mejor_b - v) / mejor_b * 100:.0f}% bajo el mejor)")
            elif v < med_b:
                print("  --> mejor que la mediana base, pero no que el mejor tramo")
            elif v < peor_b:
                print("  --> dentro del rango base: NO demuestra mejora")
            else:
                print("  --> PEOR que el peor tramo base: ALERTA")
            print(f"  limite de certificacion 5.0 ms: "
                  f"{'PASA' if v <= 5.0 else 'FALLA'}")
        print()
    print("GATE4_VENTANAS_OK")


if __name__ == "__main__":
    main()
