"""Inventario de corridas: encontrar la sesión exacta que falló (TRANSICIÓN-T0A).

POR QUÉ EXISTE ESTE MÓDULO
--------------------------
`RECOGER_EVIDENCIA_TODO.cmd` no recoge la carpeta ``runs`` completa. Para cada
instalación ordena las corridas por nombre y se queda **solo con la última**
(``$mains[$mains.Count - 1]``), y con los preflight hace exactamente lo mismo
(``$pfs[$pfs.Count - 1]``). De ahí salen los dos defectos que esta herramienta
corrige:

1. Si Jean ejecutó cualquier cosa después del fallo, aunque fuera un arranque
   abortado, la corrida fallida **no entra en el zip**.
2. El preflight que empareja es el más reciente de la instalación, que **no
   tiene por qué ser el de esa corrida**.

Este módulo no arregla el ``.cmd`` ni lo sustituye: **inventaría todas las
corridas** de un árbol, empareja cada una con SU preflight y dice cuáles
fallaron, para que la copia manual de la sección 4.3 del informe v3 se haga
sobre la carpeta correcta.

QUÉ NO HACE
-----------
No decide nada nuevo sobre la calidad de una corrida. El veredicto que publica
es una **relectura literal** del `RESULT.json` de la propia corrida, no un
criterio propio. `RESULT.json` se lee y nunca se escribe.

INVARIANTE QUE SOSTIENE LA REGLA DE «NUNCA FABRICAR UN PASS»
------------------------------------------------------------
``passed is None`` si y solo si ``motivo_ilegible is not None``. No existe
ninguna corrida cuyo veredicto quede en blanco sin que conste **por qué**. Un
`RESULT.json` que no se puede leer, o que no declara ``pass`` como booleano, no
produce una corrida «sana por omisión»: produce una corrida DESCONOCIDA con su
motivo, que se lista aparte y entra en las candidatas.

DÓNDE VIVE CADA UNO DE LOS CINCO ARCHIVOS QUE PIDE LA SECCIÓN 4.4
-----------------------------------------------------------------
Comprobado en el código del motor, no de memoria:

- ``RESULT.json``            -> raíz de la corrida        (``launcher.py:2008``)
- ``clock_postflight.json``  -> raíz de la corrida        (``launcher.py:1267-1273``,
  invocado como ``clock_postflight(project_root, run_root)`` en ``launcher.py:2520``)
- ``clock_preflight.json``   -> carpeta ``preflight_*``   (``launcher.py:1136-1141``,
  invocado con ``preflight`` como directorio de evidencia en ``launcher.py:2478`` y ``:2496``)
- ``jean_flow_metrics.jsonl``-> ``capture/``              (``dual_main.py:725``, el
  ``--output-dir`` que ``launcher.py:1830`` fija en ``run_root / "capture"``)
- ``audit_*.json``           -> ``capture/``              (``launcher.py:1589-1590``, ``:1611``, ``:1635``)

Por eso ``clock_preflight.json`` solo se puede comprobar **después** de haber
emparejado el preflight correcto: no está dentro de la corrida.

SOBRE LOS ACENTOS Y LOS SÍMBOLOS DEL INFORME DE TEXTO
-----------------------------------------------------
Esta sesión de campo cayó, entre otras cosas, porque cp1252 no supo escribir
una «θ» en la consola de Windows en español. El informe de texto de aquí usa
**solo caracteres representables en cp1252**: acentos, eñes y comillas
angulares sí; flechas, símbolos matemáticos y caracteres de dibujo de cajas no.
Es una restricción deliberada, no una casualidad de estilo.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from .comun import (
    DESCONOCIDO,
    FAIL,
    PASS,
    Lectura,
    buscar_carpetas_runs,
    leer_json,
    marca_de,
)

# Prefijo de las carpetas de preflight, tal y como las nombra el lanzador.
PREFIJO_PREFLIGHT = "preflight_"

# Nombre de la carpeta del proyecto, exigido por ``buscar_carpetas_runs``.
CARPETA_PROYECTO = "binance_phase1_collector"

# Los cinco archivos que la sección 4.4 del informe v3 pide de la sesión que
# falló. Las claves son los nombres literales, para que el informe se lea igual
# que la petición.
ARCHIVOS_CLAVE: tuple[str, ...] = (
    "RESULT.json",
    "clock_preflight.json",
    "clock_postflight.json",
    "jean_flow_metrics.jsonl",
    "audit_*.json",
)

# Estados terminales que el proyecto considera sanos. Cualquier otro valor de
# ``status`` cuenta como fallo. La comparación es literal a propósito: el motor
# escribe constantes en mayúsculas, y ser tolerante aquí solo serviría para
# tapar un fallo, nunca para descubrirlo.
ESTADOS_SANOS: tuple[str, ...] = (PASS, "OK")


@dataclass(frozen=True, slots=True)
class Corrida:
    """Una corrida encontrada en el árbol, con su veredicto releído y su preflight.

    ``passed`` y ``status`` se copian del `RESULT.json`; no se recalculan. Si el
    `RESULT.json` no se pudo leer, ``passed`` queda en ``None`` y
    ``motivo_ilegible`` explica por qué: nunca las dos cosas vacías a la vez.
    """

    ruta: Path
    nombre: str
    marca: str | None
    instalacion: Path
    capture_session_id: str | None
    status: str | None
    passed: bool | None
    label: str | None
    motivo_ilegible: str | None
    preflight: Path | None
    tiene_result: bool
    archivos_clave: dict[str, bool]

    @property
    def clasificacion(self) -> str:
        """PASS, FAIL o UNKNOWN, en ese orden de comprobación.

        DESCONOCIDO gana siempre que no se haya podido leer el veredicto: una
        corrida ilegible no es sana, y confundir «no pude mirar» con «miré y
        estaba bien» es exactamente el error que este proyecto no comete.
        """

        if self.motivo_ilegible is not None or self.passed is None:
            return DESCONOCIDO
        if not self.passed:
            return FAIL
        if self.status is not None and self.status not in ESTADOS_SANOS:
            return FAIL
        return PASS

    @property
    def es_fallida(self) -> bool:
        """Criterio de «candidata a la sesión que falló».

        Deliberadamente ancho: incluye lo ilegible. Una candidata de más cuesta
        una carpeta copiada de más; una candidata de menos cuesta perder la
        evidencia del fallo, que es justo lo que ya ocurrió una vez.
        """

        if self.passed is False:
            return True
        if self.status is not None and self.status not in ESTADOS_SANOS:
            return True
        return self.motivo_ilegible is not None

    @property
    def archivos_faltantes(self) -> list[str]:
        """Los archivos de la sección 4.4 que NO están, en el orden en que se piden."""

        return [nombre for nombre in ARCHIVOS_CLAVE if not self.archivos_clave.get(nombre, False)]


def emparejar_preflight(corrida_marca: str | None, preflights: list[Path]) -> Path | None:
    """Devuelve el preflight que de verdad corresponde a una corrida.

    Regla: la marca MAYOR de entre las MENORES O IGUALES a la de la corrida. Es
    decir, el preflight inmediatamente anterior al arranque, que es el que el
    lanzador acababa de escribir cuando esa corrida empezó.

    Si no hay ninguno anterior devuelve ``None``. **No se inventa un par.**
    Emparejar con el último preflight de la instalación, que es lo que hace hoy
    `RECOGER_EVIDENCIA_TODO.cmd`, produce un `clock_preflight.json` que puede no
    tener nada que ver con la corrida entregada: eso es peor que no entregar
    ninguno, porque parece evidencia.

    Las marcas son comparables como cadena porque su formato ``AAAAMMDDTHHMMSS``
    es de ancho fijo y de mayor a menor significación.
    """

    if corrida_marca is None:
        return None
    mejor: tuple[str, str, Path] | None = None
    for candidato in preflights:
        marca = marca_de(candidato.name)
        if marca is None or marca > corrida_marca:
            continue
        clave = (marca, candidato.name, candidato)
        if mejor is None or clave[:2] > mejor[:2]:
            mejor = clave
    return None if mejor is None else mejor[2]


def inventariar(raiz: Path) -> list[Corrida]:
    """Inventaría TODAS las corridas bajo una raíz, no solo la última.

    Recorre cada carpeta ``<algo>/binance_phase1_collector/runs`` que encuentre,
    de modo que un árbol con varias instalaciones se inventaría entero en una
    sola pasada. Orden de salida: por marca y luego por nombre, para que dos
    ejecuciones sobre el mismo árbol den exactamente la misma lista.

    Solo lectura: abre `RESULT.json` en modo binario para leerlo y nada más.
    """

    corridas: list[Corrida] = []
    for carpeta_runs in buscar_carpetas_runs(raiz):
        corridas.extend(_inventariar_carpeta_runs(carpeta_runs))
    corridas.sort(key=lambda c: (c.marca or "", c.nombre, str(c.ruta)))
    return corridas


def fallidas(corridas: list[Corrida]) -> list[Corrida]:
    """Las candidatas a «la sesión que falló», incluidas las ilegibles."""

    return [corrida for corrida in corridas if corrida.es_fallida]


def informe_texto(corridas: list[Corrida]) -> str:
    """Informe legible para Jean, que no es programador.

    Tres bloques: la tabla de todo lo encontrado, las corridas DESCONOCIDAS
    aparte y bien visibles, y al final las candidatas con la lista exacta de los
    archivos de la sección 4.4 que le faltan a cada una.
    """

    lineas: list[str] = []
    lineas.append("INVENTARIO DE CORRIDAS JEAN_FLOW")
    lineas.append("=" * 78)

    if not corridas:
        lineas.append("")
        lineas.append("No se encontró ninguna corrida.")
        lineas.append(
            "Comprueba que la ruta contiene una carpeta "
            f"{CARPETA_PROYECTO}\\runs con subcarpetas de corrida."
        )
        return "\n".join(lineas)

    candidatas = fallidas(corridas)
    desconocidas = [c for c in corridas if c.clasificacion == DESCONOCIDO]
    sanas = [c for c in corridas if c.clasificacion == PASS]
    con_fallo = [c for c in corridas if c.clasificacion == FAIL]

    lineas.append("")
    lineas.append(
        f"Corridas encontradas: {len(corridas)}   "
        f"(sanas: {len(sanas)}, con fallo declarado: {len(con_fallo)}, "
        f"desconocidas: {len(desconocidas)})"
    )
    instalaciones = sorted({str(c.instalacion) for c in corridas})
    lineas.append(f"Instalaciones inventariadas: {len(instalaciones)}")
    for instalacion in instalaciones:
        lineas.append(f"  - {instalacion}")

    lineas.append("")
    lineas.append("TODAS LAS CORRIDAS")
    lineas.append("-" * 78)
    cabeceras = ("MARCA", "ETIQUETA", "VEREDICTO", "STATUS", "PREFLIGHT EMPAREJADO", "CORRIDA")
    filas = [
        (
            corrida.marca or "(sin marca)",
            corrida.label or "-",
            _veredicto_legible(corrida),
            corrida.status or "-",
            corrida.preflight.name if corrida.preflight is not None else "(ninguno anterior)",
            corrida.nombre,
        )
        for corrida in corridas
    ]
    lineas.extend(_tabla(cabeceras, filas))

    if desconocidas:
        lineas.append("")
        lineas.append("CORRIDAS DESCONOCIDAS: NO se pudo leer su RESULT.json")
        lineas.append("-" * 78)
        lineas.append(
            "Una corrida ilegible NO es una corrida sana. No se sabe qué pasó en ella,"
        )
        lineas.append("y por eso se lista aparte y cuenta como candidata.")
        for corrida in desconocidas:
            lineas.append("")
            lineas.append(f"  {corrida.nombre}")
            lineas.append(f"    Carpeta: {corrida.ruta}")
            lineas.append(f"    Motivo:  {corrida.motivo_ilegible}")

    lineas.append("")
    lineas.append("CANDIDATAS A «LA SESIÓN QUE FALLÓ»")
    lineas.append("=" * 78)
    if not candidatas:
        lineas.append("")
        lineas.append("Ninguna corrida de este árbol declara fallo ni resultó ilegible.")
        lineas.append(
            "Eso NO demuestra que no hubiera un fallo: demuestra que la corrida fallida"
        )
        lineas.append(
            "no está en este árbol, o que se sobrescribió. Busca en otra instalación."
        )
    else:
        lineas.append("")
        lineas.append(
            f"{len(candidatas)} corrida(s) para copiar a mano, con su preflight, "
            "según la sección 4.3."
        )
        for numero, corrida in enumerate(candidatas, start=1):
            lineas.append("")
            lineas.append(f"  [{numero}] {corrida.nombre}   ({_veredicto_legible(corrida)})")
            lineas.append(f"      Carpeta de la corrida: {corrida.ruta}")
            if corrida.preflight is not None:
                lineas.append(f"      Preflight que le toca: {corrida.preflight}")
            else:
                lineas.append(
                    "      Preflight que le toca: NINGUNO anterior a esta corrida. "
                    "No copies otro."
                )
            lineas.append(f"      status:               {corrida.status or '(no declarado)'}")
            lineas.append(
                "      pass:                 "
                f"{'(no legible)' if corrida.passed is None else str(corrida.passed).lower()}"
            )
            if corrida.motivo_ilegible is not None:
                lineas.append(f"      Motivo de ilegible:   {corrida.motivo_ilegible}")
            if corrida.capture_session_id:
                lineas.append(f"      capture_session_id:   {corrida.capture_session_id}")
            faltantes = corrida.archivos_faltantes
            if faltantes:
                lineas.append(
                    f"      FALTAN {len(faltantes)} de los 5 archivos que se piden: "
                    + ", ".join(faltantes)
                )
            else:
                lineas.append("      Están los 5 archivos que se piden.")

    lineas.append("")
    lineas.append("-" * 78)
    lineas.append(
        "Recordatorio: RECOGER_EVIDENCIA_TODO.cmd recoge SOLO la corrida más reciente"
    )
    lineas.append(
        "de cada instalación, y empareja el último preflight, que puede no ser el suyo."
    )
    lineas.append(
        "Si la candidata de arriba no es la corrida más reciente, el zip NO la contiene:"
    )
    lineas.append("hay que copiar a mano esa carpeta y su preflight. Copiar es solo lectura.")
    return "\n".join(lineas)


def informe_json(corridas: list[Corrida]) -> dict:
    """El mismo inventario en forma de objeto, apto para ``escribir_json_atomico``.

    Sin marcas de tiempo de emisión: dos ejecuciones sobre el mismo árbol deben
    producir el mismo objeto, para poder compararlas.
    """

    candidatas = fallidas(corridas)
    return {
        "herramienta": "localizar",
        "proposito": "TRANSICION-T0A: localizar la sesión exacta que falló",
        "archivos_pedidos": list(ARCHIVOS_CLAVE),
        "totales": {
            "corridas": len(corridas),
            "candidatas": len(candidatas),
            "sanas": sum(1 for c in corridas if c.clasificacion == PASS),
            "con_fallo_declarado": sum(1 for c in corridas if c.clasificacion == FAIL),
            "desconocidas": sum(1 for c in corridas if c.clasificacion == DESCONOCIDO),
        },
        "instalaciones": sorted({str(c.instalacion) for c in corridas}),
        "corridas": [_corrida_a_json(c) for c in corridas],
        "candidatas": [c.nombre for c in candidatas],
        "nota": (
            "El veredicto es una relectura literal del RESULT.json de cada corrida, "
            "no un criterio nuevo. Una corrida ilegible se declara UNKNOWN con su "
            "motivo y cuenta como candidata; nunca se da por sana."
        ),
    }


# --------------------------------------------------------------------------- #
# Interno
# --------------------------------------------------------------------------- #


def _inventariar_carpeta_runs(carpeta_runs: Path) -> list[Corrida]:
    """Inventaría una sola carpeta ``runs``, emparejando preflights dentro de ella.

    El emparejado es por instalación, igual que la realidad del disco: los
    preflight de una instalación no pertenecen a las corridas de otra.
    """

    try:
        hijos = sorted(p for p in carpeta_runs.iterdir() if p.is_dir())
    except OSError:
        # Una carpeta ilegible no puede tumbar el inventario del resto del árbol.
        return []

    preflights = [
        hijo
        for hijo in hijos
        if hijo.name.startswith(PREFIJO_PREFLIGHT) and marca_de(hijo.name) is not None
    ]
    instalacion = _instalacion_de(carpeta_runs)

    corridas: list[Corrida] = []
    for hijo in hijos:
        if hijo in preflights:
            continue
        marca = marca_de(hijo.name)
        if marca is None and not (hijo / "RESULT.json").is_file():
            # Ni nombre de corrida ni RESULT.json dentro: no es una corrida.
            continue
        # Una carpeta con RESULT.json y nombre raro SÍ se inventaría, con
        # ``marca`` a None. Descartarla por el nombre sería perder justo la
        # corrida que alguien renombró a mano.
        corridas.append(_construir_corrida(hijo, marca, instalacion, preflights))
    return corridas


def _construir_corrida(
    ruta: Path, marca: str | None, instalacion: Path, preflights: list[Path]
) -> Corrida:
    ruta_result = ruta / "RESULT.json"
    tiene_result = ruta_result.is_file()
    lectura = leer_json(ruta_result)
    passed, status, label, capture_session_id, motivo = _releer_veredicto(lectura)
    preflight = emparejar_preflight(marca, preflights)
    return Corrida(
        ruta=ruta,
        nombre=ruta.name,
        marca=marca,
        instalacion=instalacion,
        capture_session_id=capture_session_id,
        status=status,
        passed=passed,
        label=label,
        motivo_ilegible=motivo,
        preflight=preflight,
        tiene_result=tiene_result,
        archivos_clave=_archivos_clave(ruta, preflight),
    )


def _releer_veredicto(
    lectura: Lectura,
) -> tuple[bool | None, str | None, str | None, str | None, str | None]:
    """Copia el veredicto del `RESULT.json`. No lo recalcula ni lo completa.

    Mantiene la invariante del módulo: si ``pass`` no es un booleano de verdad,
    el veredicto no se pudo leer, y eso se dice con un motivo. Un `RESULT.json`
    sin ``pass`` utilizable no produce una corrida sana por descarte.
    """

    if not lectura.ok or lectura.datos is None:
        return None, None, None, None, lectura.motivo or "no se pudo leer"

    datos = lectura.datos
    status = _texto(datos.get("status"))
    label = _texto(datos.get("label"))
    capture_session_id = _capture_session_id(datos)

    crudo = datos.get("pass")
    if not isinstance(crudo, bool):
        tipo = "ausente" if "pass" not in datos else f"de tipo {type(crudo).__name__}"
        return (
            None,
            status,
            label,
            capture_session_id,
            f"el RESULT.json no declara «pass» como booleano ({tipo})",
        )
    return crudo, status, label, capture_session_id, None


def _capture_session_id(datos: dict[str, Any]) -> str | None:
    """Busca el identificador de sesión donde el motor lo publica de verdad.

    Comprobado en el `RESULT.json` de la corrida ``d64fea5560ac``: el mismo
    valor aparece en la raíz, en ``ready`` y en ``session_manifest``. Se prueban
    en ese orden y se devuelve el primero utilizable; si no hay ninguno, None.
    """

    directo = _texto(datos.get("capture_session_id"))
    if directo:
        return directo
    for contenedor in ("ready", "session_manifest"):
        anidado = datos.get(contenedor)
        if isinstance(anidado, dict):
            valor = _texto(anidado.get("capture_session_id"))
            if valor:
                return valor
    return None


def _archivos_clave(ruta: Path, preflight: Path | None) -> dict[str, bool]:
    """Presencia de los cinco archivos de la sección 4.4, cada uno donde vive.

    ``clock_preflight.json`` se busca en la carpeta ``preflight_*`` emparejada,
    no dentro de la corrida: el lanzador lo escribe ahí
    (``launcher.py:1141``, con ``evidence_dir`` = la carpeta de preflight). Si
    no hay preflight emparejado, el archivo se declara ausente, que es la
    verdad: no hay ningún `clock_preflight.json` que se pueda atribuir a esta
    corrida.
    """

    capture = ruta / "capture"
    hay_audit = False
    if capture.is_dir():
        hay_audit = any(p.is_file() for p in capture.glob("audit_*.json"))
    return {
        "RESULT.json": (ruta / "RESULT.json").is_file(),
        "clock_preflight.json": (
            preflight is not None and (preflight / "clock_preflight.json").is_file()
        ),
        "clock_postflight.json": (ruta / "clock_postflight.json").is_file(),
        "jean_flow_metrics.jsonl": (capture / "jean_flow_metrics.jsonl").is_file(),
        "audit_*.json": hay_audit,
    }


def _instalacion_de(carpeta_runs: Path) -> Path:
    """La carpeta que contiene ``binance_phase1_collector``.

    ``buscar_carpetas_runs`` ya garantiza esa forma, pero la comprobación se
    repite aquí porque esta función también se usa sobre rutas construidas a
    mano en las pruebas.
    """

    padre = carpeta_runs.parent
    if padre.name == CARPETA_PROYECTO:
        return padre.parent
    return padre


def _corrida_a_json(corrida: Corrida) -> dict[str, Any]:
    return {
        "nombre": corrida.nombre,
        "ruta": str(corrida.ruta),
        "marca": corrida.marca,
        "instalacion": str(corrida.instalacion),
        "capture_session_id": corrida.capture_session_id,
        "status": corrida.status,
        "pass": corrida.passed,
        "label": corrida.label,
        "motivo_ilegible": corrida.motivo_ilegible,
        "preflight": None if corrida.preflight is None else str(corrida.preflight),
        "tiene_result": corrida.tiene_result,
        "archivos_clave": dict(corrida.archivos_clave),
        "archivos_faltantes": corrida.archivos_faltantes,
        "clasificacion": corrida.clasificacion,
        "es_candidata": corrida.es_fallida,
    }


def _veredicto_legible(corrida: Corrida) -> str:
    return {
        PASS: "sana",
        FAIL: "FALLO",
        DESCONOCIDO: "DESCONOCIDA",
    }[corrida.clasificacion]


def _texto(valor: Any) -> str | None:
    """Devuelve el valor solo si es una cadena no vacía. Nada de convertir tipos."""

    if isinstance(valor, str) and valor.strip():
        return valor
    return None


def _tabla(cabeceras: Sequence[str], filas: Sequence[Sequence[str]]) -> list[str]:
    """Tabla de ancho fijo con caracteres ASCII, legible en cualquier consola."""

    anchos = [len(c) for c in cabeceras]
    for fila in filas:
        for indice, celda in enumerate(fila):
            anchos[indice] = max(anchos[indice], len(celda))
    lineas = ["  ".join(c.ljust(anchos[i]) for i, c in enumerate(cabeceras)).rstrip()]
    lineas.append("  ".join("-" * ancho for ancho in anchos))
    for fila in filas:
        lineas.append("  ".join(celda.ljust(anchos[i]) for i, celda in enumerate(fila)).rstrip())
    return lineas
