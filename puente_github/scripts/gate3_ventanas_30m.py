#!/usr/bin/env python3
"""Trocea el gate 3 en ventanas de 30 minutos para que el A/B sea honesto.

El gate 3 corrio 4h45; el gate 4 correra 30 min. Comparar el "peor p99 de todo
el run" de uno contra el del otro favorece al corto por pura aritmetica: menos
tiempo es menos oportunidades de tropezar con el pico raro.

La solucion es no comparar contra un numero sino contra una DISTRIBUCION: se
parte el gate 3 en tramos de 30 min y se calcula el peor p99 de cada tramo. Asi,
cuando el gate 4 devuelva su unico peor p99, se puede decir en que percentil de
los tramos base cae. Un solo tramo bueno no prueba nada; uno mejor que todos si.
"""
import json
import os
from collections import defaultdict

G3 = ("/home/trading/jean-flow-exec/staging_runs/"
      "20260827T143004Z_tokyo_n2_capture_gate3_2h")
METRICAS = os.path.join(G3, "capture", "jean_flow_metrics.jsonl")
VENTANA_NS = 30 * 60 * 1_000_000_000
INTERES = ("book_apply", "book_pipeline_total", "writer_cooperative_yield",
           "event_loop_lag")


def buscar_p99(nodo, prefijo=""):
    """Recorre el registro y devuelve (metrica, mercado, p99_ms) donde los halle."""
    if isinstance(nodo, dict):
        for metrica in INTERES:
            bloque = nodo.get(metrica)
            if isinstance(bloque, dict):
                p99 = bloque.get("p99_ms", bloque.get("p99"))
                if isinstance(p99, (int, float)):
                    yield metrica, prefijo, float(p99)
        for clave, valor in nodo.items():
            if clave not in INTERES:
                yield from buscar_p99(valor, prefijo or str(clave))


def main():
    if not os.path.isfile(METRICAS):
        print("no existe", METRICAS)
        return
    print("fichero:", METRICAS, os.path.getsize(METRICAS), "bytes")

    t0 = None
    # tramos[(metrica, mercado)][indice_de_tramo] = peor p99 visto
    tramos = defaultdict(lambda: defaultdict(float))
    leidas = 0
    with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            linea = linea.strip()
            if not linea.startswith("{"):
                continue
            try:
                reg = json.loads(linea)
            except ValueError:
                continue
            ts = (reg.get("timestamp_utc_ns") or reg.get("ts_utc_ns")
                  or reg.get("utc_ns") or reg.get("monotonic_ns"))
            if not isinstance(ts, int):
                continue
            leidas += 1
            if t0 is None:
                t0 = ts
            idx = (ts - t0) // VENTANA_NS
            for metrica, mercado, p99 in buscar_p99(reg):
                clave = (metrica, mercado)
                if p99 > tramos[clave][idx]:
                    tramos[clave][idx] = p99

    print("registros con marca de tiempo:", leidas)
    if not tramos:
        print("SIN_DATOS_DE_P99 - revisar el formato del jsonl")
        with open(METRICAS, encoding="utf-8", errors="ignore") as fh:
            for i, linea in enumerate(fh):
                if linea.strip().startswith("{"):
                    print("muestra:", linea[:900])
                    break
                if i > 50:
                    break
        return

    print()
    print("=== peor p99 por tramo de 30 min (linea base del gate 3) ===")
    for (metrica, mercado), por_tramo in sorted(tramos.items()):
        valores = [v for _, v in sorted(por_tramo.items()) if v > 0]
        if not valores:
            continue
        orden = sorted(valores)
        n = len(orden)
        print(f"\n{mercado}.{metrica}  ({n} tramos de 30 min)")
        print("  peores por tramo: " +
              " ".join(f"{v:.3f}" for v in valores))
        print(f"  mejor tramo={orden[0]:.3f}  mediana={orden[n // 2]:.3f}  "
              f"peor tramo={orden[-1]:.3f}")
        print(f"  -> para ganar de verdad, el gate 4 debe quedar por debajo de "
              f"{orden[0]:.3f} ms (el mejor tramo base)")
    print("\nVENTANAS_OK")


if __name__ == "__main__":
    main()
