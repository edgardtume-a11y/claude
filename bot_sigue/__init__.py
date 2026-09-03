"""
bot_sigue — supervisor local para un chat automatizado.

Sustituye el `enviar("sigue")` ciego por una decisión con tres salidas:
enviar (a veces "sigue", a veces algo específico), parar cuando la tarea
terminó, y avisar cuando hace falta un humano.

Uso mínimo:

    from bot_sigue import Supervisor

    sup = Supervisor()
    d = sup.decidir(mensajes_del_asistente)      # lista de strings

    if d.accion == "enviar":
        enviar(d.mensaje)
    elif d.accion == "parar":
        marcar_completado()
    elif d.accion == "avisar":
        notificarme(d.motivo)
    # "esperar" -> no hacer nada todavía (debounce)
"""

from __future__ import annotations

import time
from typing import Iterable

from . import config
from .clasificador import ACCIONES, ESTADOS, Decision, Sesion, clasificar

__all__ = ["Supervisor", "Decision", "Sesion", "ESTADOS", "ACCIONES", "clasificar"]


class Supervisor:
    """Aplica las reglas de sesión sobre la clasificación del modelo.

    Las reglas son deterministas a propósito: contar repeticiones y medir
    tiempos lo hace mejor un `if` que un modelo de lenguaje.
    """

    def __init__(self, sesion: Sesion | None = None, reloj=time.monotonic):
        self.sesion = sesion or Sesion()
        self._reloj = reloj

    # -------------------------------------------------------------- interno

    def _en_debounce(self, ahora: float) -> bool:
        if self.sesion.ultimo_envio_ts == 0.0:
            return False
        return (ahora - self.sesion.ultimo_envio_ts) < config.DEBOUNCE_S

    def _aplicar_reglas(self, d: Decision) -> Decision:
        """Convierte 'enviar' en 'avisar' cuando el chat no está avanzando."""
        if d.accion != "enviar":
            return d

        if d.estado == "bucle" and self.sesion.bucles_seguidos + 1 >= config.MAX_BUCLES:
            d.accion = "avisar"
            d.mensaje = ""
            d.motivo = (
                f"{self.sesion.bucles_seguidos + 1} bucles seguidos: "
                f"{d.motivo or 'el asistente no avanza'}"
            )
            return d

        repetido = (
            self.sesion.veces_mismo_estado + 1
            if d.estado == self.sesion.estado_previo
            else 1
        )
        if repetido >= config.MAX_ENVIOS_MISMO_ESTADO:
            d.accion = "avisar"
            d.mensaje = ""
            d.motivo = (
                f"{repetido} veces seguidas en estado '{d.estado}' sin avanzar"
            )

        return d

    # -------------------------------------------------------------- público

    def decidir(self, mensajes_gpt: Iterable[str]) -> Decision:
        """Decide qué hacer a partir de los últimos mensajes del asistente."""
        ahora = self._reloj()

        if self._en_debounce(ahora):
            restante = config.DEBOUNCE_S - (ahora - self.sesion.ultimo_envio_ts)
            return Decision(
                estado=self.sesion.estado_previo or "cortado",
                accion="esperar",
                motivo=f"debounce: faltan {restante:.0f}s para poder enviar",
            )

        decision = self._aplicar_reglas(clasificar(mensajes_gpt))
        self.sesion.registrar(decision, ahora)
        return decision

    def reiniciar(self) -> None:
        """Empieza un chat nuevo: olvida contadores y tiempos."""
        self.sesion = Sesion()
