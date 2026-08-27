#!/usr/bin/env python3
"""Reescribe la prueba del gate 4 con el alcance CORREGIDO por el revisor.

El plan original pedia tres mejoras. Al leer el codigo real resulto que M1
(domar el recolector de basura) y M2 (escritura por lotes) YA estaban hechas,
y M2 ademas es inaplicable: el escritor es un hilo del sistema operativo, no
una tarea asyncio, asi que no hay bucle de eventos al que cederle el turno.

Queda entonces lo que de verdad falta:
  - uvloop como bucle de eventos (M3)
  - gc.freeze() antes de entrar al bucle (el trozo de M1 que faltaba)

Esta prueba verifica esas dos cosas sobre el codigo, mas las salvaguardas que
no se pueden romper.
"""
import os

RUN = ("/home/trading/jean-flow-exec/staging_runs/"
       "20260827T195636Z_tokyo_n2_gate4_mejoras_30m")
DESTINO = os.path.join(RUN, "overlay", "tests", "test_gate4_mejoras.py")
VIEJO = os.path.join(RUN, "overlay", "tests", "test_gate4_mejoras.py.original")

PRUEBA = '''"""Gate 4: verificacion de las mejoras de latencia realmente pendientes.

Alcance corregido tras leer el codigo (ver planes/AUDITORIA_MEJORAS_CORREGIDA.md):
M1 y M2 ya existian; lo que faltaba es uvloop y gc.freeze().
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

FUENTE = Path(__file__).resolve().parents[1] / "src" / "binance_collector"
DUAL_MAIN = FUENTE / "dual_main.py"
WRITER = FUENTE / "writer.py"
LATENCY = FUENTE / "latency.py"


@pytest.fixture(scope="module")
def texto_dual_main() -> str:
    return DUAL_MAIN.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def arbol_dual_main(texto_dual_main: str) -> ast.Module:
    return ast.parse(texto_dual_main)


# --- Lo que se anade -------------------------------------------------------

def test_uvloop_se_importa_de_forma_tolerante(texto_dual_main: str) -> None:
    """uvloop debe importarse sin que su ausencia tumbe el motor."""
    assert "uvloop" in texto_dual_main, "no hay rastro de uvloop"
    assert re.search(r"except\\s+ImportError", texto_dual_main), (
        "uvloop debe importarse dentro de un try/except ImportError: si el "
        "paquete falta, la captura tiene que arrancar igual"
    )


def test_uvloop_se_usa_como_bucle_de_eventos(texto_dual_main: str) -> None:
    """No basta con importarlo: hay que pasarlo a asyncio.run."""
    assert "loop_factory" in texto_dual_main, (
        "uvloop debe entrar por el parametro loop_factory de asyncio.run "
        "(CPython 3.12), no por uvloop.install()"
    )


def test_se_registra_que_bucle_se_uso(texto_dual_main: str) -> None:
    """Sin traza en el log no se puede certificar que uvloop actuo."""
    assert "event_loop=" in texto_dual_main, (
        "falta la linea de log 'event_loop=' que dice si corrio uvloop o asyncio"
    )


def test_gc_freeze_se_llama(texto_dual_main: str) -> None:
    assert "gc.freeze()" in texto_dual_main, "falta la llamada a gc.freeze()"
    assert "gc_frozen=" in texto_dual_main, (
        "falta la linea de log 'gc_frozen=' con el numero de objetos congelados"
    )


def test_gc_freeze_va_antes_del_bucle(arbol_dual_main: ast.Module,
                                      texto_dual_main: str) -> None:
    """Congelar despues de arrancar el bucle no sirve de nada."""
    lineas = texto_dual_main.splitlines()
    linea_freeze = next(
        (i for i, ln in enumerate(lineas) if "gc.freeze()" in ln), None)
    linea_run = next(
        (i for i, ln in enumerate(lineas) if "asyncio.run(" in ln), None)
    assert linea_freeze is not None, "no se encontro gc.freeze()"
    assert linea_run is not None, "no se encontro asyncio.run("
    assert linea_freeze < linea_run, (
        "gc.freeze() debe ejecutarse ANTES de entrar al bucle de eventos"
    )


# --- Lo que no se puede romper --------------------------------------------

def test_nunca_se_desactiva_el_recolector(texto_dual_main: str) -> None:
    """gc.disable() en una captura de horas es una fuga de memoria segura."""
    assert "gc.disable" not in texto_dual_main, (
        "PROHIBIDO gc.disable(): congelar no es desactivar"
    )


def test_no_se_toco_el_umbral_del_recolector(texto_dual_main: str) -> None:
    """Los umbrales son competencia de latency.low_latency_runtime."""
    assert "set_threshold" not in texto_dual_main, (
        "los umbrales del recolector los fija latency.py, no dual_main.py"
    )


def test_el_contrato_de_parada_sigue_intacto(texto_dual_main: str) -> None:
    assert "_validate_stop_request" in texto_dual_main
    for campo in ("capture_session_id", "requested_by_pid",
                  "requested_utc_ns", "launcher_shutdown"):
        assert campo in texto_dual_main, (
            f"el contrato de parada perdio el campo {campo}"
        )


def test_el_motor_sigue_saliendo_con_20(texto_dual_main: str) -> None:
    assert "exit_code = 20" in texto_dual_main, (
        "RuntimeContractError debe seguir dando codigo de salida 20"
    )


def test_dual_main_compila(texto_dual_main: str) -> None:
    ast.parse(texto_dual_main)


# --- Lo que ya existia: no debe haberse degradado -------------------------

def test_el_escritor_sigue_troceando(  ) -> None:
    """M2 ya estaba hecha. Se comprueba que nadie la deshizo."""
    texto = WRITER.read_text(encoding="utf-8")
    assert "write_chunk_rows" in texto
    assert "writerows(" in texto, "el escritor debe seguir escribiendo por lotes"


def test_el_escritor_sigue_siendo_un_hilo() -> None:
    """Por esto M2 'ceder el turno al bucle' era inaplicable: no hay bucle aqui."""
    texto = WRITER.read_text(encoding="utf-8")
    assert "threading.Thread" in texto, (
        "el escritor es un hilo del sistema, no una tarea asyncio"
    )


def test_los_umbrales_del_recolector_siguen_domados() -> None:
    """M1 ya estaba hecha en latency.py. Se comprueba que sigue ahi."""
    texto = LATENCY.read_text(encoding="utf-8")
    assert "gc.set_threshold" in texto
    assert "GC_THRESHOLD_0" in texto
    assert "gc.disable" not in texto
'''


def main() -> None:
    if os.path.exists(DESTINO) and not os.path.exists(VIEJO):
        os.rename(DESTINO, VIEJO)
        print("prueba anterior guardada en", os.path.basename(VIEJO))
    with open(DESTINO, "w", encoding="utf-8") as fh:
        fh.write(PRUEBA)
    print("prueba escrita:", DESTINO)
    print("lineas:", PRUEBA.count("\n"))
    import ast as _ast
    _ast.parse(PRUEBA)
    print("PRUEBA_GATE4_CORREGIDA_OK")


if __name__ == "__main__":
    main()
