#!/usr/bin/env python3
"""Es el writer quien alarga la cola del loop? Experimento controlado, offline.

write_chunk_rows es cuantas filas escribe el writer antes de ceder. Si el writer
compite por el GIL con el loop, el lag debe CRECER con ese numero.

Resultado medido (28/08/2026): a chunk=64, que es produccion, el lag es ~1.3 ms
con independencia de la carga. El writer queda descartado como causa de la cola.

No graba nada, no toca produccion, no usa red. Directorio temporal que se borra.

Requiere el interprete del release, que tiene aiohttp y uvloop:
  /home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
"""
import asyncio, sys, tempfile, statistics
from pathlib import Path

RAIZ = Path("/home/trading/jean-flow-worktree")
sys.path.insert(0, str(RAIZ / "src"))
sys.path.insert(0, str(RAIZ / "benchmarks"))

import benchmark_latency as bl   # noqa: E402


async def medir(niveles: int, chunk: int, yield_s: float, reps: int = 5):
    """Mediana de `reps` medidas del lag del loop mientras el writer escribe."""
    snap = bl._snapshot(niveles)
    p50s, p99s, maxs = [], [], []
    for _ in range(reps):
        with tempfile.TemporaryDirectory() as tmp:
            r, _ = await bl._benchmark_writer_lag(snap, Path(tmp) / "w", chunk, yield_s)
        p50s.append(r.get("p50_ms", r.get("p50", 0.0)))
        p99s.append(r.get("p99_ms", r.get("p99", 0.0)))
        maxs.append(r.get("max_ms", r.get("max", 0.0)))
    return statistics.median(p50s), statistics.median(p99s), statistics.median(maxs)


async def main():
    NIVELES = 5_000

    print("A - barrido de write_chunk_rows (la palanca del GIL)")
    print(f"  {'chunk':>7s} {'p50':>9s} {'p99':>9s} {'max':>9s}")
    for chunk in (8, 32, 64, 256, 1024, 4096, 16384):
        p50, p99, mx = await medir(NIVELES, chunk, 0.0005)
        print(f"  {chunk:7d} {p50:9.3f} {p99:9.3f} {mx:9.3f}")

    print("\nB - barrido de carga con chunk fijo en 64")
    print(f"  {'filas':>7s} {'p50':>9s} {'p99':>9s} {'max':>9s}")
    for niveles in (250, 1_000, 5_000, 20_000):
        p50, p99, mx = await medir(niveles, 64, 0.0005)
        print(f"  {niveles*2:7d} {p50:9.3f} {p99:9.3f} {mx:9.3f}")

    print("\nC - el tiempo de cesion importa? (el codigo exige 0.0001..0.01)")
    print(f"  {'yield_s':>9s} {'p50':>9s} {'p99':>9s} {'max':>9s}")
    for ys in (0.0001, 0.0005, 0.002, 0.008):
        p50, p99, mx = await medir(NIVELES, 64, ys)
        print(f"  {ys:9.4f} {p50:9.3f} {p99:9.3f} {mx:9.3f}")

    print("\nD - interaccion carga x chunk, que es lo decisivo")
    print(f"  {'filas':>7s} {'chunk':>7s} {'p50':>9s} {'p99':>9s} {'max':>9s}")
    for niveles in (1_000, 20_000):
        for chunk in (64, 4096):
            p50, p99, mx = await medir(niveles, chunk, 0.0005)
            print(f"  {niveles*2:7d} {chunk:7d} {p50:9.3f} {p99:9.3f} {mx:9.3f}")


asyncio.run(main())
