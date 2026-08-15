#!/usr/bin/env python3
"""Punto de entrada único de las herramientas de evidencia JEAN_FLOW.

Deliberadamente UNO solo. Hoy Jean maneja cinco archivos `.cmd` distintos, y
cuatro de ellos viven fuera del paquete sellado; ese es el origen real de su
queja de «muchas configuraciones». Estas herramientas no repiten ese error.

    python EJECUTAR.py localizar C:\\JF
    python EJECUTAR.py saltos    <carpeta_corrida>\\capture
    python EJECUTAR.py causal    <carpeta_corrida>
    python EJECUTAR.py reloj     --limite-ms 50

Nada de lo que hay aquí modifica la evidencia, necesita permisos de
administrador o instala nada. Ver README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Permite ejecutar este archivo directamente sin instalar el paquete.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def _salida(datos: object, *, como_json: bool) -> None:
    if como_json:
        print(json.dumps(datos, indent=2, sort_keys=True, ensure_ascii=False))
    else:
        print(datos)


def _cmd_localizar(args: argparse.Namespace) -> int:
    from jf_evidencia import localizar

    raiz = Path(args.raiz)
    if not raiz.is_dir():
        print(f"No existe la carpeta {raiz}", file=sys.stderr)
        return 2

    # Se usa la variante con incidencias, y no `inventariar`, porque una carpeta
    # que no se pudo leer TIENE que llegar hasta Jean. Salir aquí con «no
    # encontré ninguna corrida» cuando en realidad no se pudo mirar sería
    # presentar un «no pude ver» como un «no había nada», que es exactamente la
    # confusión que este proyecto prohíbe.
    corridas, incidencias = localizar.inventariar_con_incidencias(raiz)

    if not corridas and not incidencias:
        print(f"No encontré ninguna corrida de JEAN_FLOW bajo {raiz}.")
        print("Comprueba que la ruta contiene una carpeta binance_phase1_collector\\runs.")
        return 1

    _salida(
        localizar.informe_json(corridas, incidencias)
        if args.json
        else localizar.informe_texto(corridas, incidencias),
        como_json=args.json,
    )
    # Sin corridas pero con carpetas ilegibles el resultado no es «todo en
    # orden»: es «no se pudo mirar», y el código de salida lo refleja.
    return 1 if not corridas else 0


def _cmd_saltos(args: argparse.Namespace) -> int:
    from jf_evidencia import detector_saltos

    carpeta = Path(args.capture)
    if not carpeta.is_dir():
        print(f"No existe la carpeta {carpeta}", file=sys.stderr)
        return 2
    series = detector_saltos.analizar_captura(carpeta, umbral_ms=args.umbral_ms)
    if not series:
        print(f"No encontré ficheros events-*.csv utilizables bajo {carpeta}.")
        return 1
    _salida(
        detector_saltos.informe_json(series) if args.json else detector_saltos.informe_texto(series),
        como_json=args.json,
    )
    estado, _ = detector_saltos.veredicto(series)
    return 0 if estado != "FAIL" else 3


def _cmd_causal(args: argparse.Namespace) -> int:
    from jf_evidencia import resultado_causal

    run_dir = Path(args.corrida)
    if not run_dir.is_dir():
        print(f"No existe la carpeta {run_dir}", file=sys.stderr)
        return 2
    destino = Path(args.destino) if args.destino else None
    ruta, motivo = resultado_causal.emitir(
        run_dir, ahora_ns=time.time_ns(), destino=destino
    )
    if ruta is None:
        print("No se emitió el artefacto, y esto es un resultado honesto, no un fallo.")
        print(f"Motivo: {motivo}")
        return 1
    print(f"Escrito: {ruta}")
    print(json.dumps(json.loads(ruta.read_text(encoding="utf-8")), indent=2, ensure_ascii=False))
    return 0


def _cmd_reloj(args: argparse.Namespace) -> int:
    from jf_evidencia import sonda_reloj

    servidores = tuple(args.servidor) if args.servidor else sonda_reloj.SERVIDORES_POR_DEFECTO
    resultado = sonda_reloj.medir(
        servidores,
        muestras_por_servidor=args.muestras,
        limite_ms=args.limite_ms,
        timeout_s=args.timeout_s,
    )
    _salida(
        sonda_reloj.informe_json(resultado) if args.json else sonda_reloj.informe_texto(resultado),
        como_json=args.json,
    )
    if args.muestras_jsonl:
        sonda_reloj.escribir_muestras_jsonl(resultado, Path(args.muestras_jsonl))
        print(f"Muestras crudas en: {args.muestras_jsonl}")
    return {"PASS": 0, "UNKNOWN": 1, "FAIL": 3}.get(resultado.veredicto, 1)


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="EJECUTAR.py",
        description="Herramientas de evidencia JEAN_FLOW. Solo lectura sobre runs/, sin elevación.",
    )
    parser.add_argument("--json", action="store_true", help="salida en JSON en vez de texto")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("localizar", help="inventaria las corridas y señala cuáles fallaron")
    p.add_argument("raiz", help="carpeta raíz donde buscar, por ejemplo C:\\JF")
    p.set_defaults(funcion=_cmd_localizar)

    p = sub.add_parser("saltos", help="busca saltos del reloj en los CSV ya capturados")
    p.add_argument("capture", help="carpeta capture de una corrida")
    p.add_argument("--umbral-ms", type=float, default=None, dest="umbral_ms")
    p.set_defaults(funcion=_cmd_saltos)

    p = sub.add_parser("causal", help="emite RESULTADO_CAUSAL.json con los tres veredictos")
    p.add_argument("corrida", help="carpeta de la corrida, la que contiene RESULT.json")
    p.add_argument("--destino", default=None, help="ruta alternativa de salida")
    p.set_defaults(funcion=_cmd_causal)

    p = sub.add_parser("reloj", help="mide el desvío del reloj y publica su banda demostrada")
    p.add_argument("--servidor", action="append", default=None)
    p.add_argument("--muestras", type=int, default=8, help="muestras por servidor")
    p.add_argument("--limite-ms", type=float, default=50.0, dest="limite_ms")
    p.add_argument("--timeout-s", type=float, default=2.0, dest="timeout_s")
    p.add_argument("--muestras-jsonl", default=None, dest="muestras_jsonl")
    p.set_defaults(funcion=_cmd_reloj)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = construir_parser().parse_args(argv)
    try:
        return int(args.funcion(args))
    except KeyboardInterrupt:
        print("\nInterrumpido. No se modificó nada.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
