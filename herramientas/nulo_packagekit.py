#!/usr/bin/env python3
"""Es coincidencia? Prueba de concentracion contra la hipotesis nula.

Si PackageKit arranca cada T segundos, el desfase de un suceso cualquiera
respecto al arranque anterior se distribuye uniforme en [0, T). La pregunta
no es si hay un arranque cerca -- siempre lo hay -- sino si los desfases se
agrupan mas de lo que agruparia el azar.
"""
import subprocess, sys
from datetime import datetime

DESDE = "2026-08-27 14:00:00"
HASTA = "2026-08-27 20:00:00"

# los 6 flancos medidos (inicio de la ventana del flanco), mercado spot
FLANCOS = [
    "2026-08-27 17:14:32", "2026-08-27 17:24:35", "2026-08-27 18:24:33",
    "2026-08-27 18:34:30", "2026-08-27 19:24:31", "2026-08-27 19:34:34",
]

out = subprocess.run(
    ["journalctl", "-u", "packagekit.service", "--since", DESDE, "--until", HASTA,
     "-o", "short-iso", "--no-pager"],
    capture_output=True, text=True, timeout=180).stdout

arranques = []
for l in out.splitlines():
    if "Starting" in l:
        try:
            arranques.append(datetime.fromisoformat(l.split()[0]).replace(tzinfo=None))
        except Exception:
            pass
arranques.sort()

print(f"arranques de packagekit entre {DESDE} y {HASTA}: {len(arranques)}")
if len(arranques) >= 2:
    gaps = [(arranques[i + 1] - arranques[i]).total_seconds()
            for i in range(len(arranques) - 1)]
    gaps_s = sorted(gaps)
    print(f"  intervalo entre arranques: mediana {gaps_s[len(gaps_s)//2]:.1f} s, "
          f"min {min(gaps):.1f}, max {max(gaps):.1f}")
    T = gaps_s[len(gaps_s) // 2]
else:
    T = 600.0

print(f"\n{'flanco (UTC)':22s} {'arranque previo':22s} {'desfase':>10s}")
desfases = []
for f in FLANCOS:
    tf = datetime.fromisoformat(f)
    previos = [a for a in arranques if a <= tf]
    if not previos:
        print(f"{f:22s} {'(ninguno antes)':22s}")
        continue
    a = previos[-1]
    d = (tf - a).total_seconds()
    desfases.append(d)
    print(f"{f:22s} {a.strftime('%Y-%m-%d %H:%M:%S'):22s} {d:9.1f} s")

if desfases:
    ancho = max(desfases) - min(desfases)
    n = len(desfases)
    print(f"\nlos {n} desfases caen en una banda de {ancho:.1f} s "
          f"dentro de un periodo de {T:.0f} s")
    # p-valor: probabilidad de que n uniformes caigan en ALGUNA banda de ese ancho
    p = n * (ancho / T) ** (n - 1)
    print(f"  p-valor aproximado (banda movil, n uniformes): {p:.2e}")
    print(f"  interpretacion: bajo azar, ver {n} sucesos tan agrupados ocurre "
          f"1 vez de cada {1/p:,.0f}" if p > 0 else "")
