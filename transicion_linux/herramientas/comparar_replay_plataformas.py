#!/usr/bin/env python3
"""Herramienta de la transición — compara informes de replay entre plataformas.

Es la herramienta con la que se ejecutó la prueba de fidelidad de la Fase 1
el 20 de agosto de 2026 (resultado: sellos idénticos en spot y futuros).

Compara dos informes de `binance_collector.audit journal` (uno de Windows,
uno de Linux) con el MISMO criterio que usa el launcher entre sus dos replays
(`_compare_replay_reports`): journal_integrity=PASS y causal_replay=PASS en
ambos, e igualdad completa del dict `replay` incluido su sha256 canónico.
Además reporta el diff campo a campo del informe completo, señalando qué
difiere y si es esperable (p. ej. `files`: rutas absolutas de cada máquina).

Uso:
  python3 comparar_replay_plataformas.py informe_windows.json informe_linux.json
    [--encoding-a cp1252]

El informe de Windows anterior a la 2.3.5 está escrito en cp1252 (defecto de
codificación corregido); por eso `--encoding-a` existe. Código de salida 0
solo si el veredicto de fidelidad es PASS.
"""

from __future__ import annotations

import argparse
import json
import sys


def cargar(ruta: str, encoding: str) -> dict:
    with open(ruta, encoding=encoding) as fh:
        return json.load(fh)


def comparar(a: dict, b: dict) -> dict:
    veredicto: dict[str, object] = {"pass": False, "errores": []}
    for etiqueta, informe in (("A", a), ("B", b)):
        cert = informe.get("certification")
        if not isinstance(cert, dict):
            veredicto["errores"].append(f"{etiqueta}: certification ausente")
            continue
        for clave in ("journal_integrity", "causal_replay"):
            if cert.get(clave) != "PASS":
                veredicto["errores"].append(
                    f"{etiqueta}: {clave}={cert.get(clave)!r}, se exige PASS"
                )
    replay_a, replay_b = a.get("replay"), b.get("replay")
    if not isinstance(replay_a, dict) or not isinstance(replay_b, dict):
        veredicto["errores"].append("replay ausente en uno de los informes")
        return veredicto

    veredicto["sha256_a"] = replay_a.get("sha256")
    veredicto["sha256_b"] = replay_b.get("sha256")
    veredicto["replay_sha256_identico"] = replay_a.get("sha256") == replay_b.get("sha256")
    veredicto["replay_dict_identico"] = replay_a == replay_b
    if not veredicto["replay_dict_identico"]:
        veredicto["diferencias_replay"] = {
            clave: {"a": replay_a.get(clave), "b": replay_b.get(clave)}
            for clave in sorted(set(replay_a) | set(replay_b))
            if replay_a.get(clave) != replay_b.get(clave)
        }

    diferencias_informe = {}
    for clave in sorted(set(a) | set(b)):
        if a.get(clave) != b.get(clave):
            diferencias_informe[clave] = {
                "esperable": clave == "files",
                "nota": "rutas absolutas propias de cada máquina" if clave == "files" else "",
            }
    veredicto["campos_que_difieren_en_el_informe"] = diferencias_informe
    inesperadas = [k for k, v in diferencias_informe.items() if not v["esperable"]]
    if inesperadas:
        veredicto["errores"].append(f"campos inesperadamente distintos: {inesperadas}")

    veredicto["pass"] = (
        not veredicto["errores"]
        and veredicto["replay_dict_identico"]
        and veredicto["replay_sha256_identico"]
    )
    return veredicto


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("informe_a")
    parser.add_argument("informe_b")
    parser.add_argument("--encoding-a", default="utf-8")
    parser.add_argument("--encoding-b", default="utf-8")
    args = parser.parse_args()
    resultado = comparar(
        cargar(args.informe_a, args.encoding_a),
        cargar(args.informe_b, args.encoding_b),
    )
    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if resultado["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
