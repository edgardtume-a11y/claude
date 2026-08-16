"""Utilidades compartidas de las herramientas de evidencia JEAN_FLOW.

Contrato de este módulo, que el resto da por supuesto:

- Nada de aquí abre un archivo de evidencia en modo escritura.
- Toda salida se escribe de forma atómica: temporal en el mismo directorio y
  ``os.replace`` al final, de modo que nunca exista un archivo a medias.
- Solo biblioteca estándar. Compatible con Python 3.11 o posterior.
- Cuando algo no se puede leer o no se puede decidir, se devuelve ``None`` o
  ``DESCONOCIDO`` con su motivo. Nunca un valor por omisión que finja un dato.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

# Estados de veredicto. Se usan como cadenas en los artefactos emitidos.
PASS = "PASS"
FAIL = "FAIL"
DESCONOCIDO = "UNKNOWN"

ESTADOS_VALIDOS = (PASS, FAIL, DESCONOCIDO)

# Nombre de carpeta de corrida: 20260814T081136_503806Z_10m_<id>
PATRON_CORRIDA = re.compile(r"^(?P<marca>\d{8}T\d{6})[._]")
PATRON_PREFLIGHT = re.compile(r"^preflight_(?P<marca>\d{8}T\d{6})")

# Extensiones que el proyecto considera evidencia sellable.
EXTENSIONES_EVIDENCIA = (".csv", ".json", ".jsonl", ".partial", ".txt")


class ErrorEvidencia(RuntimeError):
    """La evidencia no se pudo leer o no tiene la forma esperada.

    Se usa para distinguir «no pude mirar» de «miré y salió mal», que es la
    distinción que el proyecto exige y que el gate actual no hace.
    """


@dataclass(frozen=True, slots=True)
class Lectura:
    """Resultado de intentar leer un JSON de evidencia.

    ``datos`` es None cuando la lectura falló; ``motivo`` explica por qué.
    Nunca se devuelven ambas cosas vacías: o hay datos o hay motivo.
    """

    ruta: Path
    datos: dict[str, Any] | None
    motivo: str | None = None
    sha256: str | None = None

    @property
    def ok(self) -> bool:
        return self.datos is not None


@dataclass(slots=True)
class Hallazgos:
    """Acumulador de motivos, para no perder el porqué de un DESCONOCIDO."""

    motivos: list[str] = field(default_factory=list)

    def anotar(self, motivo: str) -> None:
        if motivo and motivo not in self.motivos:
            self.motivos.append(motivo)

    def texto(self) -> str:
        return "; ".join(self.motivos)

    def __bool__(self) -> bool:
        return bool(self.motivos)


def sha256_de(ruta: Path, *, bloque: int = 1 << 20) -> str:
    """SHA-256 de un archivo, leído por bloques para no cargarlo entero."""

    digest = hashlib.sha256()
    with ruta.open("rb") as fh:
        while True:
            trozo = fh.read(bloque)
            if not trozo:
                break
            digest.update(trozo)
    return digest.hexdigest()


def leer_json(ruta: Path, *, con_sello: bool = True) -> Lectura:
    """Lee un JSON de evidencia sin fallar nunca con excepción.

    Devuelve una ``Lectura``. El caso del `audit_metrics.json` de la sesión
    d64fea5560ac es exactamente por lo que esto existe: aquel archivo contenía
    un rastro de excepción de Python en vez de un informe, y la diferencia
    entre «el informe no se pudo leer» y «los datos están mal» hay que poder
    declararla.
    """

    if not ruta.is_file():
        return Lectura(ruta, None, "no existe")
    try:
        crudo = ruta.read_bytes()
    except OSError as exc:
        return Lectura(ruta, None, f"no se pudo leer: {exc}")

    sello = hashlib.sha256(crudo).hexdigest() if con_sello else None

    try:
        texto = crudo.decode("utf-8")
    except UnicodeDecodeError as exc:
        # El fallo real de campo: byte 0xE9 (la 'é' de cp1252) en la posición
        # 700 y 767 de los informes de replay. No es un fallo de datos.
        return Lectura(
            ruta, None, f"no es UTF-8 válido ({exc.reason} en el byte {exc.start})", sello
        )

    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as exc:
        pista = texto.lstrip()[:60].replace("\n", " ")
        if pista.startswith("Traceback"):
            motivo = "contiene un rastro de excepción de Python, no un informe"
        else:
            motivo = f"JSON inválido en la línea {exc.lineno}"
        return Lectura(ruta, None, motivo, sello)

    if not isinstance(datos, dict):
        return Lectura(ruta, None, f"la raíz es {type(datos).__name__}, no un objeto", sello)
    return Lectura(ruta, datos, None, sello)


def escribir_json_atomico(ruta: Path, datos: dict[str, Any]) -> None:
    """Escribe un JSON de forma atómica, con fsync antes del renombrado.

    Mismo criterio que usa el motor: nunca puede existir un archivo a medias,
    ni siquiera si el proceso muere entre la escritura y el renombrado.
    """

    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, indent=2, sort_keys=True, ensure_ascii=False)
    descriptor, temporal = tempfile.mkstemp(
        dir=str(ruta.parent), prefix=f".{ruta.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(texto)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(temporal, ruta)
    except BaseException:
        with _silencioso():
            os.unlink(temporal)
        raise


class _silencioso:
    """Suprime cualquier excepción del bloque. Solo para limpieza."""

    def __enter__(self) -> None:
        return None

    def __exit__(self, *_: object) -> bool:
        return True


def marca_de(nombre: str) -> str | None:
    """Extrae la marca de tiempo del nombre de una corrida o de un preflight.

    Devuelve None si el nombre no sigue ninguno de los dos patrones. Se usa
    para emparejar cada corrida con SU preflight, que es lo que
    RECOGER_EVIDENCIA_TODO.cmd no hace: ese script empareja siempre el último
    preflight de la instalación, que puede no ser el correspondiente.
    """

    for patron in (PATRON_CORRIDA, PATRON_PREFLIGHT):
        encaje = patron.match(nombre)
        if encaje:
            return encaje.group("marca")
    return None


def buscar_carpetas_runs(raiz: Path, *, profundidad: int = 8) -> Iterator[Path]:
    """Encuentra las carpetas ``runs`` de JEAN_FLOW bajo una raíz.

    Exige que el padre se llame ``binance_phase1_collector``, igual que hace
    el recolector oficial, para no confundir una carpeta ``runs`` cualquiera
    con una del proyecto.
    """

    if not raiz.is_dir():
        return
    raiz_resuelta = raiz.resolve()
    for actual, subdirectorios, _ in os.walk(raiz_resuelta):
        ruta_actual = Path(actual)
        try:
            nivel = len(ruta_actual.relative_to(raiz_resuelta).parts)
        except ValueError:  # pragma: no cover - defensivo
            continue
        if nivel >= profundidad:
            subdirectorios[:] = []
            continue
        if ruta_actual.name == "runs" and ruta_actual.parent.name == "binance_phase1_collector":
            yield ruta_actual


def numero_finito(valor: Any) -> bool:
    """True si el valor es un número real y finito. Rechaza bool a propósito."""

    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return False
    try:
        return float(valor) == float(valor) and abs(float(valor)) != float("inf")
    except (TypeError, ValueError, OverflowError):  # pragma: no cover - defensivo
        return False
