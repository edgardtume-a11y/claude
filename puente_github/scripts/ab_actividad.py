#!/usr/bin/env python3
"""¿La mejora del gate 4 es de uvloop o de que el mercado estaba flojo?

Si el gate 4 proceso tantos o mas mensajes por minuto que la linea base, la
tranquilidad del mercado deja de explicar la mejora. Si proceso muchos menos,
la mejora es sospechosa y no se puede atribuir a uvloop.

Tambien saca event_loop_lag del gate 3, que faltaba para comparar.
"""
import json
import os
import re
from datetime import datetime

BASE = "/home/trading/jean-flow-exec/staging_runs"
G3 = os.path.join(BASE, "20260827T143004Z_tokyo_n2_capture_gate3_2h")
G4 = os.path.join(BASE, "20260827T195636Z_tokyo_n2_gate4_mejoras_30m")
CABECERA = re.compile(r"^metrics market=(\S+)\s+(\{.*\})\s*$", re.S)
CONTADORES = ("websocket_messages", "depth_diff_messages", "agg_trade_messages",
              "csv_rows_written")


def recorrer(ruta):
    """Devuelve por mercado: (duracion_s, ultimos contadores, peor lag p99)."""
    t0 = {}
    t1 = {}
    fin = {}
    peor_lag = {}
    with open(os.path.join(ruta, "capture", "jean_flow_metrics.jsonl"),
              encoding="utf-8", errors="ignore") as fh:
        for linea in fh:
            try:
                reg = json.loads(linea)
                m = CABECERA.match(reg.get("message") or "")
            except ValueError:
                continue
            if not m:
                continue
            try:
                t = datetime.fromisoformat(reg["timestamp"]).timestamp()
            except (KeyError, ValueError, TypeError):
                continue
            mercado = m.group(1)
            try:
                cuerpo = json.loads(m.group(2))
            except ValueError:
                continue
            t0.setdefault(mercado, t)
            t1[mercado] = t
            fin[mercado] = cuerpo.get("counters", {})
            lag = (cuerpo.get("latency_ms") or {}).get("event_loop_lag") or {}
            v = lag.get("p99")
            if isinstance(v, (int, float)) and v > peor_lag.get(mercado, 0):
                peor_lag[mercado] = float(v)
    return {mer: (t1[mer] - t0[mer], fin.get(mer, {}), peor_lag.get(mer, 0.0))
            for mer in t1}


def main():
    g3 = recorrer(G3)
    g4 = recorrer(G4)

    print("=== ACTIVIDAD POR MINUTO: gate 3 (sin uvloop) vs gate 4 (con uvloop) ===")
    for mercado in sorted(set(g3) & set(g4)):
        d3, c3, _ = g3[mercado]
        d4, c4, _ = g4[mercado]
        print(f"\n--- {mercado}   base={d3 / 60:.0f} min   gate4={d4 / 60:.0f} min")
        for k in CONTADORES:
            v3, v4 = c3.get(k), c4.get(k)
            if not isinstance(v3, (int, float)) or not isinstance(v4, (int, float)):
                continue
            r3 = v3 / (d3 / 60) if d3 else 0
            r4 = v4 / (d4 / 60) if d4 else 0
            if not r3:
                continue
            pct = (r4 - r3) / r3 * 100
            veredicto = ("gate 4 MAS cargado" if pct > 5
                         else "gate 4 MENOS cargado" if pct < -5
                         else "carga equivalente")
            print(f"  {k:22s} base={r3:9.1f}/min  gate4={r4:9.1f}/min  "
                  f"{pct:+6.1f}%  {veredicto}")

    print("\n=== event_loop_lag: peor p99 del run ===")
    for mercado in sorted(set(g3) & set(g4)):
        print(f"  {mercado:15s} base={g3[mercado][2]:.1f} ms   "
              f"gate4={g4[mercado][2]:.1f} ms   (limite de auditoria 20 ms)")

    print("\n=== veredicto formal de las auditorias del gate 4 ===")
    rc = os.path.join(G4, "audit", "return_codes.json")
    if os.path.isfile(rc) and os.path.getsize(rc):
        print("  " + open(rc, encoding="utf-8").read().strip())
    else:
        print("  (auditorias aun corriendo)")
    print("\nACTIVIDAD_OK")


if __name__ == "__main__":
    main()
