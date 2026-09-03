"""
Prueba el supervisor contra tu Ollama real, sin tocar tu programa.

    python3 -m bot_sigue.probar --demo             # 7 casos, uno por estado
    python3 -m bot_sigue.probar --texto "..."      # un mensaje suelto
    cat mensaje.txt | python3 -m bot_sigue.probar  # desde stdin

Con --demo mide además el acierto: cada caso trae el estado esperado.
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request

from . import Supervisor, config
from .clasificador import clasificar

CASOS: list[tuple[str, str]] = [
    (
        "cortado",
        "Vale, monto el parser. Primero la función que lee el archivo:\n\n"
        "```python\ndef leer(ruta):\n    with open(ruta) as f:\n        datos = f.re",
    ),
    (
        "pregunta",
        "Para seguir necesito decidir una cosa: ¿guardo el histórico en SQLite "
        "o basta con un JSON en disco?",
    ),
    (
        "confirmacion",
        "Tengo listo el cambio en config.py. ¿Lo aplico?",
    ),
    (
        "desviado",
        "Aprovechando, he refactorizado todo el módulo de red, cambiado el "
        "sistema de logs y actualizado las dependencias a sus últimas versiones.",
    ),
    (
        "bucle",
        "Como te decía, lo mejor es cachear el resultado. Cachear evita "
        "recalcular. Por eso conviene añadir una caché al resultado.",
    ),
    (
        "terminado",
        "Hecho. El script funciona, he probado los tres casos y pasan todos. "
        "Ya lo tienes completo.",
    ),
    (
        "error",
        "No consigo continuar: al ejecutarlo salta 'PermissionError: "
        "[Errno 13]' y no tengo acceso de escritura en esa carpeta.",
    ),
]


def ollama_vivo() -> bool:
    try:
        with urllib.request.urlopen(f"{config.OLLAMA_URL}/api/tags", timeout=3):
            return True
    except (urllib.error.URLError, OSError):
        return False


def demo() -> int:
    print(f"Modelo: {config.MODELO}   ·   Ollama: {config.OLLAMA_URL}\n")

    aciertos = 0
    total_ms = 0.0

    for esperado, texto in CASOS:
        t0 = time.perf_counter()
        d = clasificar([texto])
        ms = (time.perf_counter() - t0) * 1000
        total_ms += ms

        ok = d.estado == esperado
        aciertos += ok
        marca = "OK " if ok else "NO "

        print(f"{marca} esperado={esperado:<12} obtenido={d.estado:<12} "
              f"{ms:6.0f} ms  conf={d.confianza:.2f}")
        print(f"    motivo : {d.motivo}")
        if d.mensaje:
            print(f"    envía  : {d.mensaje!r}")
        if d.fallback:
            print("    (!) camino de seguridad: revisa que Ollama esté levantado")
        print()

    pct = 100 * aciertos / len(CASOS)
    print(f"Acierto: {aciertos}/{len(CASOS)} ({pct:.0f}%)   "
          f"· media {total_ms / len(CASOS):.0f} ms por decisión")

    if pct < 70:
        print(
            "\nPor debajo del 70 %. Antes de pensar en fine-tuning, añade "
            "ejemplos reales tuyos a EJEMPLOS en config.py: es lo que más sube "
            "el acierto."
        )
    return 0 if pct >= 70 else 1


def una_vez(texto: str) -> int:
    sup = Supervisor()
    d = sup.decidir([texto])
    print(d)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Prueba el supervisor del bot.")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--demo", action="store_true", help="ejecuta los 7 casos de prueba")
    g.add_argument("--texto", help="clasifica este mensaje")
    args = p.parse_args(argv)

    if not ollama_vivo():
        print(
            f"Ollama no responde en {config.OLLAMA_URL}.\n"
            f"Levántalo con:  ollama serve\n"
            f"Y descarga el modelo con:  ollama pull {config.MODELO}\n",
            file=sys.stderr,
        )
        return 2

    if args.demo:
        return demo()
    if args.texto:
        return una_vez(args.texto)

    entrada = sys.stdin.read().strip()
    if not entrada:
        p.print_help()
        return 1
    return una_vez(entrada)


if __name__ == "__main__":
    raise SystemExit(main())
