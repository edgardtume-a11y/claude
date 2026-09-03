"""
Mide el acierto del clasificador sobre TUS datos etiquetados.

    python3 -m bot_sigue.evaluar datos/pares.jsonl
    python3 -m bot_sigue.evaluar datos/pares.jsonl --limite 100

Usa solo las filas con `estado` relleno. Etiqueta al menos 50-100 antes de
fiarte del número; con menos, el porcentaje baila demasiado.

Salida: acierto global, acierto por estado, y con qué se confunde cada uno.
Eso último es lo útil: te dice qué ejemplos añadir a config.EJEMPLOS.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

from . import config
from .clasificador import ESTADOS, clasificar
from .probar import ollama_vivo


def cargar(ruta: Path, limite: int | None) -> list[dict]:
    filas = []
    with ruta.open(encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea:
                continue
            fila = json.loads(linea)
            if fila.get("estado") in ESTADOS and fila.get("entrada"):
                filas.append(fila)
            if limite and len(filas) >= limite:
                break
    return filas


def evaluar(filas: list[dict]) -> int:
    aciertos = 0
    fallbacks = 0
    total_ms = 0.0
    por_estado: dict[str, Counter] = defaultdict(Counter)  # esperado -> obtenido

    for i, fila in enumerate(filas, 1):
        t0 = time.perf_counter()
        d = clasificar([fila["entrada"]])
        total_ms += (time.perf_counter() - t0) * 1000

        esperado = fila["estado"]
        por_estado[esperado][d.estado] += 1
        aciertos += d.estado == esperado
        fallbacks += d.fallback

        print(f"\r  {i}/{len(filas)}", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)

    n = len(filas)
    print(f"\nAcierto global: {aciertos}/{n} ({100 * aciertos / n:.0f} %)")
    print(f"Latencia media: {total_ms / n:.0f} ms por decisión")
    if fallbacks:
        print(f"(!) {fallbacks} decisiones por camino de seguridad — "
              f"revisa Ollama, esas no cuentan como acierto del modelo")

    print("\nPor estado:")
    for estado in ESTADOS:
        cuenta = por_estado.get(estado)
        if not cuenta:
            continue
        total = sum(cuenta.values())
        bien = cuenta.get(estado, 0)
        confusiones = ", ".join(
            f"{k} ×{v}" for k, v in cuenta.most_common() if k != estado
        )
        print(f"  {estado:<13} {bien:>3}/{total:<3} "
              f"{100 * bien / total:>3.0f} %"
              + (f"   se confunde con: {confusiones}" if confusiones else ""))

    faltan = [e for e in ESTADOS if e not in por_estado]
    if faltan:
        print(f"\nSin ejemplos etiquetados de: {', '.join(faltan)}. "
              f"Etiqueta alguno para poder medirlos.")

    pct = 100 * aciertos / n
    if pct < 70:
        print("\nPor debajo del 70 %. Mira arriba con qué se confunde cada estado "
              "y añade a config.EJEMPLOS ejemplos reales de esos casos.")
    return 0 if pct >= 70 else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Evalúa el clasificador sobre datos etiquetados.")
    ap.add_argument("jsonl", type=Path)
    ap.add_argument("--limite", type=int, help="evaluar solo las N primeras filas etiquetadas")
    args = ap.parse_args(argv)

    if not args.jsonl.exists():
        print(f"No existe {args.jsonl}", file=sys.stderr)
        return 2

    filas = cargar(args.jsonl, args.limite)
    if not filas:
        print("No hay filas con 'estado' relleno. Etiqueta algunas primero:\n"
              "  abre el JSONL y pon en 'estado' uno de: " + ", ".join(ESTADOS),
              file=sys.stderr)
        return 2

    if not ollama_vivo():
        print(f"Ollama no responde en {config.OLLAMA_URL}. Levántalo con: ollama serve",
              file=sys.stderr)
        return 2

    print(f"Evaluando {len(filas)} filas etiquetadas con {config.MODELO}", file=sys.stderr)
    return evaluar(filas)


if __name__ == "__main__":
    raise SystemExit(main())
