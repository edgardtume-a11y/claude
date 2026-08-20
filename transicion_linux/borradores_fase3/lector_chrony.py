#!/usr/bin/env python3
"""BORRADOR FASE 3, NO ACTIVADO — Lector del estado de chronyd para JEAN_FLOW 555.

Sustituye a la superficie PowerShell de tools/windows/time-sync/ (39 sitios de
expresiones regulares sobre la salida TRADUCIDA de w32tm.exe, 24 códigos de
estado en la cadena de gates — 32 en el directorio contando las herramientas
manuales — STATUS_LOCALE_UNSUPPORTED incluido). Aquí no se parsea texto humano:
`chronyc -c` emite CSV estable e independiente del idioma del sistema.

NOTA PARA LA FASE 3: el launcher enruta por error_code, no por texto. Al
integrar este lector habrá que conservar la taxonomía de códigos de la cadena
de gates actual (mapeo SERVICE_STOPPED → systemctl is-active, OFFSET_OUT_OF_
RANGE → banda de tracking, etc.); los códigos de este borrador son el
subconjunto mínimo del contrato de lectura.

Emite por stdout un JSON con el mismo espíritu del contrato de
clock_preflight.json vigente, más lo que aquel no podía decir: la BANDA de
incertidumbre demostrable. Distingue explícitamente los dos criterios que el
gate actual confunde (INFORME_TRANSICION_LINUX_v2, secciones 2.3 y 6.3):

  - gate_residual:  |offset| <= limite               (lo que el gate hace hoy)
  - utc_calificada: |offset| + delay_raiz/2 + dispersion_raiz <= limite
                    (la exactitud UTC demostrable; hoy es INFORMATIVA y puede
                    valer UNKNOWN sin invalidar nada — DECISIÓN DEL PROYECTO)

Falla cerrado: si chronyd no corre, no responde o no está sincronizado, el
resultado es pass=false con código explícito. Nunca inventa un PASS.

Uso:  python3 lector_chrony.py [--warn-ms 50.0] [--limite-utc-ms 50.0]
Salida: JSON UTF-8 por stdout; código de salida 0 solo si pass=true.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

# Campos de `chronyc -c tracking`, en orden, según chrony(1). CSV estable:
# no depende del locale, a diferencia de la salida de w32tm /query /status.
_TRACKING_FIELDS = (
    "ref_id",
    "ref_name",
    "stratum",
    "ref_time_unix",
    "system_offset_s",      # offset actual estimado del reloj del sistema
    "last_offset_s",        # offset medido en la última actualización
    "rms_offset_s",
    "freq_ppm",
    "resid_freq_ppm",
    "skew_ppm",
    "root_delay_s",         # δ acumulada hasta el estrato 0
    "root_dispersion_s",    # ε acumulada hasta el estrato 0
    "update_interval_s",
    "leap_status",
)

_LEAP_OK = "Normal"
_LEAP_UNSYNC = "Not synchronised"


def _chronyc(*args: str, timeout_s: float = 10.0) -> tuple[int, str, str]:
    try:
        completed = subprocess.run(
            ["chronyc", "-c", *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout_s,
            check=False,
        )
    except FileNotFoundError:
        return 127, "", "chronyc no está instalado"
    except subprocess.TimeoutExpired:
        return 124, "", "chronyc no respondió en el tiempo límite"
    return completed.returncode, completed.stdout.strip(), completed.stderr.strip()


def leer_estado(warn_ms: float, limite_utc_ms: float) -> dict[str, object]:
    resultado: dict[str, object] = {
        "offset_method": "chronyd_tracking_csv",
        "utc_check_time_ns": time.time_ns(),
        "warn_ms": warn_ms,
        "limite_utc_ms": limite_utc_ms,
        "pass": False,
        "error_code": "STATUS_UNKNOWN",
        "utc_calificada": "UNKNOWN",
    }

    codigo, salida, error = _chronyc("tracking")
    if codigo == 127:
        resultado.update(error_code="STATUS_CHRONYC_NOT_INSTALLED", message=error)
        return resultado
    if codigo == 124:
        resultado.update(error_code="STATUS_CHRONYD_TIMEOUT", message=error)
        return resultado
    if codigo != 0 or not salida:
        resultado.update(
            error_code="STATUS_CHRONYD_NOT_RUNNING",
            message=error or "chronyc devolvió código distinto de cero",
        )
        return resultado

    campos = salida.split(",")
    if len(campos) < len(_TRACKING_FIELDS):
        resultado.update(
            error_code="STATUS_TRACKING_FORMAT",
            message=f"chronyc tracking devolvió {len(campos)} campos, "
            f"se esperaban {len(_TRACKING_FIELDS)}",
        )
        return resultado

    crudo = dict(zip(_TRACKING_FIELDS, campos))
    resultado["tracking_raw_csv"] = salida

    try:
        stratum = int(crudo["stratum"])
        offset_s = float(crudo["system_offset_s"])
        root_delay_s = float(crudo["root_delay_s"])
        root_dispersion_s = float(crudo["root_dispersion_s"])
    except ValueError as exc:
        resultado.update(error_code="STATUS_TRACKING_PARSE", message=str(exc))
        return resultado

    leap = crudo["leap_status"]
    abs_offset_ms = abs(offset_s) * 1000.0
    # Banda demostrable: la mitad del viaje de ida y vuelta acumulado más la
    # dispersión acumulada. Es el mismo argumento de la sección 2.4 del
    # informe: un offset puntual sin su banda no certifica exactitud.
    banda_ms = (root_delay_s / 2.0 + root_dispersion_s) * 1000.0
    incertidumbre_total_ms = abs_offset_ms + banda_ms

    resultado.update(
        stratum=stratum,
        leap_status=leap,
        phase_offset_ms=round(offset_s * 1000.0, 4),
        abs_phase_offset_ms=round(abs_offset_ms, 4),
        root_delay_ms=round(root_delay_s * 1000.0, 4),
        root_dispersion_ms=round(root_dispersion_s * 1000.0, 4),
        banda_ms=round(banda_ms, 4),
        incertidumbre_total_ms=round(incertidumbre_total_ms, 4),
        ref_name=crudo["ref_name"],
        freq_ppm=crudo["freq_ppm"],
        skew_ppm=crudo["skew_ppm"],
        update_interval_s=crudo["update_interval_s"],
    )

    if leap == _LEAP_UNSYNC or stratum == 0:
        resultado.update(
            error_code="STATUS_UNSYNCHRONISED",
            message="chronyd corre pero no está sincronizado con ninguna fuente",
        )
        return resultado

    # Fuentes: cuántas hay y cuántas son utilizables. Evidencia, no gate.
    codigo_f, salida_f, _ = _chronyc("sources")
    if codigo_f == 0 and salida_f:
        fuentes = [linea.split(",") for linea in salida_f.splitlines()]
        resultado["sources_total"] = len(fuentes)
        resultado["sources_csv"] = salida_f.splitlines()

    # Veredicto 1 — el gate residual vigente (mismo umbral, mismo sentido que
    # CLOCK_WARN_MS; NO se toca el número):
    gate_residual = abs_offset_ms <= warn_ms
    resultado["gate_residual_pass"] = gate_residual

    # Veredicto 2 — calidad UTC calificada (informativa; DECISIÓN DEL
    # PROYECTO: en esta entrega nunca puede negar nada):
    if incertidumbre_total_ms <= limite_utc_ms:
        resultado["utc_calificada"] = "DEMOSTRADA"
    else:
        resultado["utc_calificada"] = "INSUFICIENTE"

    resultado["pass"] = bool(gate_residual)
    resultado["error_code"] = "PASS" if gate_residual else "STATUS_OFFSET_EXCEEDS_WARN"
    resultado["message"] = (
        f"chronyd sincronizado (estrato {stratum}); offset {abs_offset_ms:.3f} ms; "
        f"banda ±{banda_ms:.3f} ms; UTC calificada: {resultado['utc_calificada']}"
    )
    return resultado


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warn-ms", type=float, default=50.0)
    parser.add_argument("--limite-utc-ms", type=float, default=50.0)
    args = parser.parse_args()
    estado = leer_estado(args.warn_ms, args.limite_utc_ms)
    json.dump(estado, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if estado.get("pass") is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
