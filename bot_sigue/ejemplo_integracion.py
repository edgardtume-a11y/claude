"""
Cómo enchufarlo a tu programa. Ejecutable tal cual:

    python3 -m bot_sigue.ejemplo_integracion

Recorre un chat que se corta, pregunta y termina, para que veas las tres
ramas. Si Ollama está levantado usa el modelo de verdad; si no, simula las
respuestas para que el flujo se vea igual (y lo dice claramente).
"""

from __future__ import annotations

import json
from unittest import mock

from . import Supervisor, config
from . import clasificador
from .probar import ollama_vivo


# --- lo que hoy hace tu programa -------------------------------------------
#
#   while chat_parado():
#       enviar("sigue")
#
# --- lo que pasa a hacer ----------------------------------------------------


def enviar(texto: str) -> None:
    print(f"  → ENVIAR   {texto!r}")


def marcar_completado() -> None:
    print("  → PARAR    tarea terminada, no se envía nada más")


def notificarme(motivo: str) -> None:
    print(f"  → AVISAR   {motivo}")


def paso(sup: Supervisor, mensajes_del_asistente: list[str]) -> str:
    """El reemplazo de `enviar("sigue")`. Devuelve la acción tomada."""
    d = sup.decidir(mensajes_del_asistente)

    if d.accion == "enviar":
        enviar(d.mensaje)
    elif d.accion == "parar":
        marcar_completado()
    elif d.accion == "avisar":
        notificarme(d.motivo)
    # "esperar": aún dentro del debounce, no se hace nada

    return d.accion


# --- andamiaje solo para la demo -------------------------------------------


class RelojDemo:
    """Avanza más allá del debounce entre pasos, para no esperar de verdad."""

    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t

    def siguiente_paso(self) -> None:
        self.t += config.DEBOUNCE_S + 1


def _simulado(estado: str, mensaje: str = ""):
    return {
        "message": {
            "content": json.dumps(
                {
                    "estado": estado,
                    "confianza": 0.9,
                    "motivo": "(simulado: Ollama no está levantado)",
                    "mensaje": mensaje,
                },
                ensure_ascii=False,
            )
        }
    }


CONVERSACION = [
    (
        "Empiezo con el parser:\n```python\ndef leer(ruta):\n    with open(ru",
        ("cortado", "sigue"),
    ),
    (
        "¿Guardo el resultado en SQLite o en un JSON plano?",
        ("pregunta", "JSON plano. Simple antes que genérico; ya migraré si hace falta."),
    ),
    (
        "Listo, funciona y he probado los tres casos. Lo tienes completo.",
        ("terminado", ""),
    ),
]


def main() -> int:
    real = ollama_vivo()
    if real:
        print(f"Usando Ollama real · modelo {config.MODELO}\n")
    else:
        print(
            "Ollama no está levantado: las respuestas del modelo van SIMULADAS\n"
            "para que se vea el flujo. Con `ollama serve` verías las de verdad.\n"
        )

    reloj = RelojDemo()
    sup = Supervisor(reloj=reloj)
    historial: list[str] = []

    for i, (mensaje, simulacion) in enumerate(CONVERSACION, 1):
        historial.append(mensaje)
        primera_linea = mensaje.splitlines()[0]
        print(f"[{i}] Asistente: {primera_linea[:66]}...")

        if real:
            accion = paso(sup, historial)
        else:
            with mock.patch.object(
                clasificador, "_pedir_a_ollama", return_value=_simulado(*simulacion)
            ):
                accion = paso(sup, historial)

        print()
        if accion == "parar":
            break
        reloj.siguiente_paso()

    print("Con `sigue` a secas, el paso 2 se habría ignorado y el 3 habría")
    print("seguido generando relleno indefinidamente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
