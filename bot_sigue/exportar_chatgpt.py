"""
Convierte tu export de ChatGPT en ejemplos para el supervisor.

    python3 -m bot_sigue.exportar_chatgpt conversations.json
    python3 -m bot_sigue.exportar_chatgpt conversations.json --salida datos/pares.jsonl
    python3 -m bot_sigue.exportar_chatgpt conversations.json --config 15

Dónde sale el archivo: ChatGPT → Configuración → Controles de datos →
Exportar datos. Llega un zip con `conversations.json` dentro.

Cada vez que el asistente dijo algo y tú respondiste, eso es un par de
entrenamiento. Este script los extrae, los limpia y los deja en JSONL con
un campo `estado` vacío para que etiquetes los que quieras usar en
`evaluar.py` y `entrenar_colab.py`. Con `--config N` imprime los N mejores
ya en formato Python para pegarlos en EJEMPLOS de config.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

# Un mensaje del asistente puede ser larguísimo; para clasificar importa
# el final, que es donde se corta, pregunta o cierra.
COLA_ENTRADA = 900

# Respuestas tuyas demasiado cortas ("ok", "sí") no enseñan estilo.
MIN_SALIDA = 12
# Y las larguísimas suelen ser pegados de código o logs, no respuestas.
MAX_SALIDA = 1200


@dataclass
class Par:
    entrada: str
    salida: str
    estado: str = ""
    sugerencia: str = ""
    conversacion: str = ""
    fecha: str = ""


# ------------------------------------------------------------------ lectura

def _texto(mensaje: dict[str, Any] | None) -> str | None:
    """Texto plano de un mensaje del export, o None si no es texto."""
    if not mensaje:
        return None
    contenido = mensaje.get("content") or {}
    if contenido.get("content_type") != "text":
        return None
    partes = [p for p in contenido.get("parts") or [] if isinstance(p, str)]
    texto = "\n".join(partes).strip()
    return texto or None


def _camino(conv: dict[str, Any]) -> list[dict[str, Any]]:
    """Mensajes en orden, siguiendo la rama actual de la conversación.

    El export guarda un árbol (cada regeneración abre una rama). La rama
    que ves en la interfaz es la que termina en `current_node`; se recorre
    hacia atrás por `parent` y se invierte.
    """
    mapping = conv.get("mapping") or {}
    nodo_id = conv.get("current_node")

    if not nodo_id or nodo_id not in mapping:
        # Sin current_node: coger cualquier hoja y subir desde ahí.
        hojas = [k for k, v in mapping.items() if not v.get("children")]
        nodo_id = hojas[0] if hojas else None

    mensajes: list[dict[str, Any]] = []
    visitados: set[str] = set()
    while nodo_id and nodo_id in mapping and nodo_id not in visitados:
        visitados.add(nodo_id)
        nodo = mapping[nodo_id]
        if nodo.get("message"):
            mensajes.append(nodo["message"])
        nodo_id = nodo.get("parent")
    mensajes.reverse()
    return mensajes


def _fecha(ts: float | None) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def _sugerir(entrada: str) -> str:
    """Heurística conservadora: solo se atreve con lo obvio."""
    ultima = entrada.rstrip().splitlines()[-1].strip() if entrada.strip() else ""
    if ultima.endswith("?") or ultima.endswith("¿"):
        return "pregunta"
    return ""


def extraer(conversaciones: list[dict[str, Any]]) -> Iterator[Par]:
    for conv in conversaciones:
        titulo = (conv.get("title") or "").strip()
        mensajes = _camino(conv)

        for anterior, actual in zip(mensajes, mensajes[1:]):
            if (anterior.get("author") or {}).get("role") != "assistant":
                continue
            if (actual.get("author") or {}).get("role") != "user":
                continue

            entrada = _texto(anterior)
            salida = _texto(actual)
            if not entrada or not salida:
                continue
            if not (MIN_SALIDA <= len(salida) <= MAX_SALIDA):
                continue

            entrada = entrada[-COLA_ENTRADA:]
            yield Par(
                entrada=entrada,
                salida=salida,
                sugerencia=_sugerir(entrada),
                conversacion=titulo,
                fecha=_fecha(actual.get("create_time")),
            )


def deduplicar(pares: Iterator[Par]) -> list[Par]:
    vistos: set[tuple[str, str]] = set()
    unicos: list[Par] = []
    for p in pares:
        clave = (p.entrada[-200:], p.salida)
        if clave in vistos:
            continue
        vistos.add(clave)
        unicos.append(p)
    return unicos


# ------------------------------------------------------------------ salida

def escribir_jsonl(pares: list[Par], ruta: Path) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8") as f:
        for p in pares:
            f.write(json.dumps(asdict(p), ensure_ascii=False) + "\n")


def _puntuar(p: Par) -> float:
    """Los mejores ejemplos para few-shot: preguntas con respuesta tuya
    de tamaño medio. Ni monosílabos ni parrafadas."""
    puntos = 0.0
    if p.sugerencia == "pregunta":
        puntos += 3
    largo = len(p.salida)
    if 40 <= largo <= 300:
        puntos += 2
    elif largo < 40:
        puntos -= 1
    return puntos


def imprimir_config(pares: list[Par], n: int) -> None:
    """Los N mejores pares en formato Python, listos para EJEMPLOS."""
    mejores = sorted(pares, key=_puntuar, reverse=True)[:n]
    print("# Pega esto dentro de EJEMPLOS en config.py y ajusta el 'estado'")
    print("# de cada uno si la sugerencia no es correcta.\n")
    for p in mejores:
        estado = p.estado or p.sugerencia or "pregunta"
        ejemplo = {
            "entrada": p.entrada[-400:],
            "salida": {
                "estado": estado,
                "confianza": 0.9,
                "motivo": "",
                "mensaje": p.salida,
            },
        }
        print(json.dumps(ejemplo, ensure_ascii=False, indent=4) + ",")


# ------------------------------------------------------------------ CLI

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Extrae pares de un export de ChatGPT.")
    ap.add_argument("export", type=Path, help="conversations.json del export")
    ap.add_argument("--salida", type=Path, default=Path("datos/pares.jsonl"))
    ap.add_argument(
        "--config", type=int, metavar="N",
        help="imprime los N mejores en formato Python para config.EJEMPLOS",
    )
    ap.add_argument(
        "--aceptar-sugerencias", action="store_true",
        help="copia la sugerencia a 'estado' cuando la hay (solo 'pregunta')",
    )
    args = ap.parse_args(argv)

    try:
        datos = json.loads(args.export.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"No existe {args.export}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"{args.export} no es JSON válido: {e}", file=sys.stderr)
        return 2

    if isinstance(datos, dict):
        datos = [datos]

    pares = deduplicar(extraer(datos))
    if args.aceptar_sugerencias:
        for p in pares:
            if p.sugerencia and not p.estado:
                p.estado = p.sugerencia

    if args.config:
        imprimir_config(pares, args.config)
        return 0

    escribir_jsonl(pares, args.salida)
    con_sug = sum(1 for p in pares if p.sugerencia)
    etiquetados = sum(1 for p in pares if p.estado)
    print(f"{len(pares)} pares → {args.salida}")
    print(f"  {con_sug} con sugerencia de estado, {etiquetados} etiquetados")
    if len(pares) < 500:
        print(
            "  Menos de 500: suficiente para few-shot y para evaluar, pero "
            "corto para fine-tuning. Sigue acumulando."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
