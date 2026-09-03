"""
Clasificador de estado del chat.

Llama a un modelo local (Ollama) para decidir en qué estado está la
conversación y qué conviene enviar. Si algo falla —Ollama caído, JSON
inválido, timeout— devuelve "sigue", que es exactamente lo que hace el
programa hoy. Integrarlo nunca puede empeorar el comportamiento actual.
"""

from __future__ import annotations

import difflib
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Iterable

from . import config

# ------------------------------------------------------------------ estados

# estado -> acción por defecto
ESTADOS: dict[str, str] = {
    "cortado": "enviar",
    "pregunta": "enviar",
    "confirmacion": "enviar",
    "desviado": "enviar",
    "error": "enviar",
    "bucle": "enviar",      # la primera vez se intenta reconducir
    "terminado": "parar",
}

ACCIONES = ("enviar", "parar", "avisar", "esperar")

ESQUEMA = {
    "type": "object",
    "properties": {
        "estado": {"type": "string", "enum": list(ESTADOS)},
        "confianza": {"type": "number", "minimum": 0, "maximum": 1},
        "motivo": {"type": "string"},
        "mensaje": {"type": "string"},
    },
    "required": ["estado", "confianza", "motivo", "mensaje"],
}

SISTEMA = """\
Eres el supervisor del chat de {nombre}. Observas una conversación con un
asistente de IA y decides qué hacer a continuación.

Clasifica el ÚLTIMO mensaje del asistente en uno de estos estados:

cortado       Se interrumpe a media frase, a medio bloque de código o a mitad
              de una lista. Falta contenido que había empezado.
pregunta      Termina preguntando algo concreto y espera respuesta para seguir.
confirmacion  Pide permiso antes de actuar ("¿procedo?", "¿lo aplico?").
desviado      Trabaja en algo distinto de lo pedido, o ignora una restricción.
bucle         Repite con otras palabras ideas ya dichas, sin avanzar.
terminado     La tarea está completa. Entregó el resultado y cerró.
error         Informa de un fallo, se atasca, o dice que no puede continuar.

Devuelve SOLO un objeto JSON con: estado, confianza (0-1), motivo (una frase)
y mensaje.

Reglas para el campo "mensaje":
  cortado       -> exactamente "sigue"
  pregunta      -> responde tú como lo haría {nombre}, en una o dos frases
  confirmacion  -> confirma o rechaza, breve y claro
  desviado      -> di en una frase a qué debe volver
  error         -> reformula el problema o propone otro camino
  terminado     -> cadena vacía
  bucle         -> cadena vacía

Preferencias de {nombre}, úsalas al redactar el mensaje:
{preferencias}"""


@dataclass
class Decision:
    """Lo que el supervisor decide hacer."""

    estado: str
    accion: str
    mensaje: str = ""
    confianza: float = 0.0
    motivo: str = ""
    fallback: bool = False          # True si vino del camino de seguridad

    def __str__(self) -> str:
        marca = " [fallback]" if self.fallback else ""
        extra = f" -> {self.mensaje!r}" if self.mensaje else ""
        return (
            f"{self.estado}/{self.accion}{marca} "
            f"({self.confianza:.2f}){extra} · {self.motivo}"
        )


@dataclass
class Sesion:
    """Estado que se arrastra entre decisiones de un mismo chat."""

    ultimo_envio_ts: float = 0.0
    estado_previo: str = ""
    veces_mismo_estado: int = 0
    bucles_seguidos: int = 0
    historial: list[str] = field(default_factory=list)

    def registrar(self, decision: Decision, ahora: float) -> None:
        if decision.estado == self.estado_previo:
            self.veces_mismo_estado += 1
        else:
            self.veces_mismo_estado = 1
            self.estado_previo = decision.estado

        self.bucles_seguidos = (
            self.bucles_seguidos + 1 if decision.estado == "bucle" else 0
        )

        if decision.accion == "enviar":
            self.ultimo_envio_ts = ahora


# ------------------------------------------------------------------ ayudas

def _repite(mensajes: list[str]) -> bool:
    """Comprobación determinista de repetición, previa al modelo."""
    if len(mensajes) < 2:
        return False
    ratio = difflib.SequenceMatcher(None, mensajes[-1], mensajes[-2]).ratio()
    return ratio >= config.UMBRAL_REPETICION


def _construir_mensajes(ultimos: list[str], pista_bucle: bool) -> list[dict[str, str]]:
    sistema = SISTEMA.format(
        nombre=config.NOMBRE, preferencias=config.PREFERENCIAS
    )
    msgs: list[dict[str, str]] = [{"role": "system", "content": sistema}]

    for ej in config.EJEMPLOS:
        msgs.append({"role": "user", "content": ej["entrada"]})
        msgs.append(
            {"role": "assistant", "content": json.dumps(ej["salida"], ensure_ascii=False)}
        )

    partes = []
    if len(ultimos) > 1:
        previos = "\n---\n".join(ultimos[:-1])
        partes.append(f"Mensajes anteriores del asistente:\n{previos}\n")
    partes.append(f"ÚLTIMO mensaje del asistente:\n{ultimos[-1]}")
    if pista_bucle:
        partes.append(
            "\n(Aviso: este mensaje es textualmente casi idéntico al anterior.)"
        )

    msgs.append({"role": "user", "content": "\n".join(partes)})
    return msgs


def _pedir_a_ollama(mensajes: list[dict[str, str]]) -> dict[str, Any]:
    """Una llamada a /api/chat con salida estructurada."""
    cuerpo: dict[str, Any] = {
        "model": config.MODELO,
        "messages": mensajes,
        "stream": False,
        "format": ESQUEMA,
        "options": {
            "temperature": config.TEMPERATURA,
            "num_ctx": config.NUM_CTX,
        },
        # Modo rápido: vigilar debe ser barato. Los modelos que no soportan
        # 'think' ignoran el campo; los que fallan se reintentan sin él.
        "think": False,
    }

    def _enviar(payload: dict[str, Any]) -> dict[str, Any]:
        datos = json.dumps(payload).encode("utf-8")
        peticion = urllib.request.Request(
            f"{config.OLLAMA_URL}/api/chat",
            data=datos,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(peticion, timeout=config.TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        return _enviar(cuerpo)
    except urllib.error.HTTPError:
        cuerpo.pop("think", None)
        return _enviar(cuerpo)


def _parsear(respuesta: dict[str, Any]) -> dict[str, Any] | None:
    contenido = (respuesta.get("message") or {}).get("content", "")
    if not contenido:
        return None
    try:
        datos = json.loads(contenido)
    except json.JSONDecodeError:
        return None
    if not isinstance(datos, dict) or datos.get("estado") not in ESTADOS:
        return None
    return datos


def _fallback(motivo: str) -> Decision:
    """Camino de seguridad: se comporta igual que el programa actual."""
    return Decision(
        estado="cortado",
        accion="enviar",
        mensaje="sigue",
        confianza=0.0,
        motivo=motivo,
        fallback=True,
    )


# ------------------------------------------------------------------ API

def clasificar(mensajes_gpt: Iterable[str]) -> Decision:
    """Clasifica el estado del chat. Nunca lanza: ante cualquier fallo,
    devuelve la decisión de seguridad ("sigue")."""
    ultimos = [m for m in mensajes_gpt if m and m.strip()][-config.VENTANA_MENSAJES :]
    if not ultimos:
        return _fallback("no hay mensajes que clasificar")

    pista = _repite(ultimos)

    try:
        cruda = _pedir_a_ollama(_construir_mensajes(ultimos, pista))
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return _fallback(f"Ollama no responde ({exc.__class__.__name__})")
    except json.JSONDecodeError:
        return _fallback("respuesta de Ollama ilegible")

    datos = _parsear(cruda)
    if datos is None:
        return _fallback("el modelo no devolvió un estado válido")

    estado = datos["estado"]
    mensaje = (datos.get("mensaje") or "").strip()
    if estado in ("terminado", "bucle"):
        mensaje = ""
    elif not mensaje:
        mensaje = "sigue"

    try:
        confianza = max(0.0, min(1.0, float(datos.get("confianza", 0.0))))
    except (TypeError, ValueError):
        confianza = 0.0

    return Decision(
        estado=estado,
        accion=ESTADOS[estado],
        mensaje=mensaje,
        confianza=confianza,
        motivo=str(datos.get("motivo", "")).strip(),
    )
