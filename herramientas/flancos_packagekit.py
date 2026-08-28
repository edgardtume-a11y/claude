#!/usr/bin/env python3
"""Flancos de subida del max publicado, y su distancia al arranque de PackageKit.

Metodo: en ventanas maduras (evicted>0), si max_t > max_{t-1} alguna muestra
nueva supero el maximo anterior. El suceso queda acotado entre la publicacion
anterior y la actual (~5 s de resolucion). No estima frecuencia: censura
sucesos menores que el maximo vigente.
"""
import json, sys, subprocess
from datetime import datetime, timezone

RUTA = sys.argv[1]
UMBRAL = float(sys.argv[2]) if len(sys.argv) > 2 else 100.0


def publicaciones(ruta):
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


series = {}
for ts, mercado, doc in publicaciones(RUTA):
    m = doc.get("latency_ms", {}).get("event_loop_lag")
    if m and m.get("max") is not None:
        series.setdefault(mercado, []).append(
            (datetime.fromisoformat(ts), m.get("evicted", 0), m["max"])
        )

flancos = {}
for mercado, v in series.items():
    fl = []
    prev_max = None
    prev_t = None
    for t, evicted, mx in v:
        if evicted > 0:
            if prev_max is not None and mx > prev_max + 1e-9 and mx >= UMBRAL:
                fl.append({"desde": prev_t, "hasta": t, "de": prev_max, "a": mx})
            prev_max = mx
            prev_t = t
        else:
            prev_max = mx
            prev_t = t
    flancos[mercado] = fl

# --- arranques de PackageKit en el journal ---
arranques = []
try:
    out = subprocess.run(
        ["journalctl", "-u", "packagekit.service", "--since", "2026-08-25",
         "-o", "short-iso", "--no-pager"],
        capture_output=True, text=True, timeout=120).stdout
    for l in out.splitlines():
        if "Starting" in l or "Started" in l:
            try:
                arranques.append(datetime.fromisoformat(l.split()[0].replace(",", ".")))
            except Exception:
                pass
except Exception as e:
    print(f"(journal no accesible: {e})")

print(f"fichero  : {RUTA}")
print(f"umbral   : max >= {UMBRAL} ms")
print(f"arranques de packagekit en el journal: {len(arranques)}")
print()

for mercado in sorted(flancos):
    fl = flancos[mercado]
    print(f"=== {mercado}: {len(fl)} flancos de subida por encima de {UMBRAL} ms ===")
    print(f"{'#':>2} {'ventana del flanco (UTC)':46s} {'de -> a (ms)':>22s} {'delta packagekit':>18s}")
    for i, f in enumerate(fl, 1):
        d = "sin arranque cercano"
        if arranques:
            cand = [(f["desde"] - a).total_seconds() for a in arranques
                    if -120 <= (f["desde"] - a).total_seconds() <= 300]
            if cand:
                d = f"+{min(cand, key=abs):.1f} s"
        print(f"{i:2d} {f['desde'].strftime('%Y-%m-%d %H:%M:%S')} -> "
              f"{f['hasta'].strftime('%H:%M:%S')}   "
              f"{f['de']:9.3f} -> {f['a']:9.3f}   {d:>18s}")
    print()
