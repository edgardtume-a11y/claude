"""Detector de saltos del reloj de pared sobre los CSV ya capturados.

QUÉ MIDE
========

Cada fila del CSV lleva dos marcas de tiempo tomadas en líneas consecutivas del
motor (``collector.py:627-628``: ``receive_monotonic_ns = time.monotonic_ns()``
y en la línea siguiente ``receive_utc_ns = time.time_ns()``). Una procede del
cronómetro monotónico, que nadie puede mover, y la otra del reloj de pared, que
el disciplinador sí puede mover. Su diferencia

    D = receive_time_utc_ns - receive_time_monotonic_ns

es constante salvo la cuantización del cronómetro, porque el tiempo real
transcurrido entre las dos llamadas es de nanosegundos. Si el reloj de pared se
mueve durante la captura, D da un **escalón** del tamaño del movimiento. Ese es
el único modo de fallo del reloj que daña los datos ya escritos, y es el que
este módulo busca.

POR QUÉ ESTE MÓDULO NO DEMUESTRA LO QUE PARECE DEMOSTRAR
========================================================

**El detector NO demuestra que no hubiera saltos.** Solo puede afirmar que no
encontró discontinuidades por encima de su umbral de resolución. Esta distinción
no es una cautela de estilo: es la diferencia entre una medición y una promesa,
y el proyecto ya pagó el precio de confundirlas (el gate de reloj de campo
aprobó con una sola observación de 17,478 ms y de ahí se dedujo una exactitud
que esa observación no sostenía). Las tres limitaciones, que este módulo repite
en su docstring, en su salida de texto y en su salida JSON:

1. En Windows ``time.monotonic_ns()`` avanza en tics de unos 15,625 ms. Un salto
   del reloj de pared menor que ese cuanto es sencillamente invisible aquí.
   En Linux ese cuanto desaparece y el detector gana sensibilidad.
2. Solo observa los instantes en los que hay una fila escrita. Un salto ocurrido
   dentro de un hueco del flujo de eventos no deja ningún rastro.
3. Solo cubre la ventana capturada. No dice nada del preflight, ni del
   postflight, ni de los minutos entre corridas.

LO QUE ESTE MÓDULO NO HACE
==========================

No abre nada en modo escritura, no renombra y no borra: los CSV se leen por
streaming y en modo texto de solo lectura. No lee ``RESULT.json`` ni
``CAPTURA_COMPLETA_AUDITADA.json`` para decidir nada. No necesita privilegios.
No importa nada fuera de la biblioteca estándar. Y no fabrica un PASS: cuando no
hay serie legible, cuando las series son demasiado cortas o cuando la cobertura
es dudosa, el veredicto es ``UNKNOWN`` con su motivo escrito.
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .comun import (
    DESCONOCIDO,
    FAIL,
    PASS,
    Hallazgos,
    escribir_json_atomico,
)

__all__ = [
    "CUANTO_WINDOWS_MS",
    "FACTOR_UMBRAL",
    "UMBRAL_POR_OMISION_MS",
    "FILAS_MINIMAS_UTILES",
    "LIMITACIONES",
    "NO_DEMUESTRA",
    "Serie",
    "analizar_csv",
    "analizar_captura",
    "veredicto",
    "informe_texto",
    "informe_json",
]

VERSION_DETECTOR = "1.0.0"

# Cuanto del cronómetro monotónico de Windows. Es el suelo de resolución del
# detector en esa plataforma: por debajo de esto no se puede distinguir un salto
# del reloj de pared de un tic del cronómetro.
CUANTO_WINDOWS_MS = 15.625

# Umbral = FACTOR_UMBRAL * cuanto = 46,875 ms. Por qué exactamente 3:
#
# - Con factor 1 (15,625 ms) el detector marcaría como sospechosa la evidencia
#   sana: la medición de campo sobre 20260814T081136_503806Z_10m_d64fea5560ac dio
#   un mayor salto entre filas de 15,922 ms en contado y 16,094 ms en futuros,
#   ambos por encima de un solo cuanto. Un umbral que falla sobre datos buenos no
#   es un detector, es ruido.
# - Con factor 2 (31,25 ms) el margen sobre el rango observado en esa misma
#   corrida (19,325 ms y 19,896 ms) sería de apenas 1,6 veces. Demasiado justo
#   para una máquina más cargada.
# - Con factor 3 (46,875 ms) el umbral queda cómodamente por encima de lo que la
#   evidencia sana produjo y, lo que importa de verdad, **por debajo de los
#   50 ms** que el propio proyecto usa como límite de interés para el reloj. Es
#   decir: cualquier salto lo bastante grande para importarle al criterio del
#   proyecto sigue siendo detectable. Subirlo más rompería esa propiedad.
#
# El umbral es de este detector y no toca ninguno de los cinco umbrales de las
# métricas del motor, que no se mueven nunca.
FACTOR_UMBRAL = 3.0
UMBRAL_POR_OMISION_MS = FACTOR_UMBRAL * CUANTO_WINDOWS_MS

# Por debajo de estas filas legibles la serie no cubre la ventana de forma
# significativa: se observaron demasiados pocos instantes para afirmar nada.
# No convierte la serie en un FAIL; la convierte en un UNKNOWN.
FILAS_MINIMAS_UTILES = 100

# Si se descarta más de esta fracción de las filas, la cobertura es dudosa y el
# veredicto no puede ser PASS aunque no se haya visto ningún escalón.
FRACCION_MAXIMA_DESCARTES = 0.05

# Tope de muestras retenidas para la mediana. Los CSV reales pesan 142 MB y
# 309 MB: no se carga el archivo entero ni se acumula la lista completa de
# diferencias. Por encima de este tope se decima de forma sistemática (se
# conserva una de cada 2, luego una de cada 4...) y el muestreo SE DECLARA en la
# salida, porque una mediana muestreada no es una mediana exacta.
LIMITE_MUESTRAS_MEDIANA = 1 << 17

COLUMNA_UTC = "receive_time_utc_ns"
COLUMNA_MONOTONICA = "receive_time_monotonic_ns"
COLUMNA_MERCADO = "market"

# El escritor del motor crea ``events-<marca>-<segmento>.csv.partial`` y lo
# renombra a ``.csv`` al cerrarlo (``writer.py:226`` y ``writer.py:376-377``).
# Una corrida interrumpida deja el ``.partial`` en disco, y ese archivo también
# es evidencia de la ventana: se analiza igual.
PATRONES_CSV = ("*.csv", "*.csv.partial")

NS_POR_MS = 1_000_000.0

NO_DEMUESTRA = (
    "Este detector NO demuestra que no hubiera saltos del reloj de pared. "
    "Solo puede afirmar que no encontró discontinuidades por encima de su "
    "umbral de resolución."
)

LIMITACIONES = (
    "En Windows el cronómetro monotónico avanza en tics de unos 15,625 ms: un "
    "salto menor que ese cuanto es invisible para este método. En Linux ese "
    "cuanto desaparece y la sensibilidad mejora.",
    "Solo se observan los instantes en los que hay una fila escrita: un salto "
    "ocurrido dentro de un hueco del flujo de eventos no deja rastro.",
    "Solo se cubre la ventana capturada. No se dice nada del preflight, del "
    "postflight ni del tiempo entre corridas.",
)


@dataclass(frozen=True, slots=True)
class Serie:
    """Resultado de recorrer un CSV de eventos buscando escalones en D.

    ``motivo_ilegible`` es la bisagra de honestidad de esta estructura: cuando
    no es ``None``, la serie **no se midió** y los campos numéricos no
    significan nada (valen cero por ser el tipo declarado, y ``informe_json``
    los emite como ``null`` justamente para que nadie lea un cero fabricado
    como si fuera un dato). ``sospechoso`` en una serie ilegible es ``False``
    porque no se encontró ningún escalón, no porque no lo hubiera.

    ``paso_muestreo`` vale 1 cuando la mediana es exacta; si vale N, la mediana
    se calculó sobre una de cada N filas y así se declara en la salida.
    ``filas_descartadas`` cuenta las filas que no se pudieron interpretar (fila
    corrupta, columna vacía, campo no numérico): se saltan y el recorrido sigue,
    pero si son demasiadas la cobertura deja de ser suficiente para un PASS.
    """

    ruta: Path
    mercado: str
    filas: int
    rango_ms: float
    mayor_salto_ms: float
    mediana_ns: int
    umbral_ms: float
    sospechoso: bool
    motivo_ilegible: str | None
    paso_muestreo: int = 1
    filas_descartadas: int = 0

    @property
    def medida(self) -> bool:
        """True si la serie se pudo medir de verdad."""

        return self.motivo_ilegible is None

    @property
    def suficiente(self) -> bool:
        """True si la serie tiene filas bastantes para sostener una afirmación."""

        return self.medida and self.filas >= FILAS_MINIMAS_UTILES

    @property
    def cobertura_dudosa(self) -> bool:
        """True si se descartaron demasiadas filas como para afirmar cobertura."""

        total = self.filas + self.filas_descartadas
        if total <= 0:
            return True
        return (self.filas_descartadas / total) > FRACCION_MAXIMA_DESCARTES

    @property
    def deriva_sin_escalon(self) -> bool:
        """El rango total supera el umbral pero ningún paso entre filas lo hace.

        Es el caso de un ajuste **gradual** del reloj (un deslizamiento), o de un
        escalón repartido en muchas filas. El detector no puede distinguir ambas
        cosas, así que no lo llama FAIL y tampoco lo deja pasar como PASS.
        """

        return self.medida and not self.sospechoso and self.rango_ms > self.umbral_ms


def _umbral_efectivo(umbral_ms: float | None) -> float:
    """Valida el umbral pedido. Un umbral inválido es un error del que llama."""

    if umbral_ms is None:
        return UMBRAL_POR_OMISION_MS
    if isinstance(umbral_ms, bool) or not isinstance(umbral_ms, (int, float)):
        raise ValueError("umbral_ms debe ser un número de milisegundos")
    valor = float(umbral_ms)
    if valor != valor or valor == float("inf") or valor <= 0.0:
        raise ValueError("umbral_ms debe ser un número finito y positivo")
    return valor


def _serie_ilegible(ruta: Path, mercado: str, umbral: float, motivo: str) -> Serie:
    """Serie que no se pudo medir. Nunca se marca sospechosa: no se miró."""

    return Serie(
        ruta=ruta,
        mercado=mercado,
        filas=0,
        rango_ms=0.0,
        mayor_salto_ms=0.0,
        mediana_ns=0,
        umbral_ms=umbral,
        sospechoso=False,
        motivo_ilegible=motivo,
    )


def _mercado_por_ruta(ruta: Path) -> str:
    """Mercado deducido de la carpeta contenedora (``capture/spot``, ...).

    Es solo el respaldo: si el CSV trae la columna ``market``, manda el dato del
    archivo, no el nombre de la carpeta.
    """

    nombre = ruta.parent.name
    return nombre if nombre else "desconocido"


def analizar_csv(ruta: Path, *, umbral_ms: float | None = None) -> Serie | None:
    """Recorre un CSV de eventos y devuelve su serie de D, o ``None``.

    Devuelve ``None`` solamente cuando la ruta no es un archivo (no existe, o es
    un directorio). Cualquier otro problema —archivo vacío, faltan las columnas,
    ninguna fila interpretable, error de formato CSV— se devuelve como una
    ``Serie`` con ``motivo_ilegible`` poblado. Esta función no lanza excepciones
    por culpa del contenido del archivo: la evidencia mal formada es un dato,
    no un accidente.

    El recorrido es en streaming con ``csv.reader``. Nunca se carga el archivo
    entero ni se acumula la lista completa de diferencias: basta con el mínimo,
    el máximo y el mayor delta entre filas consecutivas, más una muestra acotada
    para la mediana.
    """

    umbral = _umbral_efectivo(umbral_ms)
    ruta = Path(ruta)
    if not ruta.is_file():
        return None

    mercado = _mercado_por_ruta(ruta)

    try:
        # errors="replace": un byte que no sea UTF-8 en una columna de texto
        # (la lección del 0xE9 de cp1252 que tumbó los replays de la sesión
        # d64fea5560ac) no debe cegar al detector, porque las dos columnas que
        # aquí se leen son dígitos ASCII. Se sustituye el carácter ilegible y se
        # sigue. "utf-8-sig" descarta un BOM si alguna herramienta lo añadió.
        with ruta.open("r", encoding="utf-8-sig", errors="replace", newline="") as fh:
            lector = csv.reader(fh)
            try:
                cabecera = next(lector)
            except StopIteration:
                return _serie_ilegible(ruta, mercado, umbral, "el archivo está vacío")

            columnas = {nombre.strip(): indice for indice, nombre in enumerate(cabecera)}
            faltan = [c for c in (COLUMNA_UTC, COLUMNA_MONOTONICA) if c not in columnas]
            if faltan:
                return _serie_ilegible(
                    ruta, mercado, umbral, "faltan las columnas " + ", ".join(faltan)
                )

            indice_utc = columnas[COLUMNA_UTC]
            indice_monotonico = columnas[COLUMNA_MONOTONICA]
            indice_mercado = columnas.get(COLUMNA_MERCADO)

            minimo: int | None = None
            maximo: int | None = None
            anterior: int | None = None
            mayor_salto_ns = 0
            filas = 0
            descartadas = 0
            muestras: list[int] = []
            paso = 1
            contador = 0
            mercado_csv = ""

            try:
                for campos in lector:
                    if not campos:
                        continue
                    try:
                        diferencia = int(campos[indice_utc]) - int(campos[indice_monotonico])
                    except (IndexError, ValueError):
                        # Fila corrupta, truncada o con una marca vacía. Se salta
                        # y se sigue: la comparación con la fila siguiente se hace
                        # por encima del hueco, así que un descarte no puede
                        # esconder un escalón, solo desplazar dónde se ve.
                        descartadas += 1
                        continue

                    if not mercado_csv and indice_mercado is not None:
                        if indice_mercado < len(campos):
                            mercado_csv = campos[indice_mercado].strip()

                    filas += 1
                    if minimo is None or diferencia < minimo:
                        minimo = diferencia
                    if maximo is None or diferencia > maximo:
                        maximo = diferencia
                    if anterior is not None:
                        salto = diferencia - anterior
                        if salto < 0:
                            salto = -salto
                        if salto > mayor_salto_ns:
                            mayor_salto_ns = salto
                    anterior = diferencia

                    if contador % paso == 0:
                        muestras.append(diferencia)
                        if len(muestras) > LIMITE_MUESTRAS_MEDIANA:
                            # Decimación sistemática: se conserva una de cada dos
                            # muestras y el paso se duplica, de modo que lo
                            # retenido sigue siendo una muestra uniforme de toda
                            # la serie y la memoria queda acotada.
                            del muestras[1::2]
                            paso *= 2
                    contador += 1
            except csv.Error as exc:
                # Un error de formato a media lectura (por ejemplo un NUL dentro
                # de la línea) deja el recorrido incompleto. Media serie no
                # cubre la ventana, así que se declara ilegible en vez de
                # presentar un resultado parcial como si fuera completo.
                return _serie_ilegible(
                    ruta,
                    mercado_csv or mercado,
                    umbral,
                    f"error de formato CSV tras {filas} filas: {exc}",
                )
    except OSError as exc:
        return _serie_ilegible(ruta, mercado, umbral, f"no se pudo leer: {exc}")

    if filas == 0 or minimo is None or maximo is None:
        return _serie_ilegible(
            ruta,
            mercado_csv or mercado,
            umbral,
            f"ninguna fila con las dos marcas legibles ({descartadas} descartadas)",
        )

    rango_ms = (maximo - minimo) / NS_POR_MS
    mayor_salto_ms = mayor_salto_ns / NS_POR_MS
    # median_low devuelve un valor realmente observado en vez del promedio de
    # los dos centrales: se prefiere un dato que existió a un número calculado.
    mediana_ns = int(statistics.median_low(muestras)) if muestras else 0

    return Serie(
        ruta=ruta,
        mercado=mercado_csv or mercado,
        filas=filas,
        rango_ms=rango_ms,
        mayor_salto_ms=mayor_salto_ms,
        mediana_ns=mediana_ns,
        umbral_ms=umbral,
        sospechoso=mayor_salto_ms > umbral,
        motivo_ilegible=None,
        paso_muestreo=paso,
        filas_descartadas=descartadas,
    )


def analizar_captura(carpeta_capture: Path, *, umbral_ms: float | None = None) -> list[Serie]:
    """Analiza todos los CSV de eventos bajo una carpeta ``capture``.

    Recorre recursivamente (``capture/spot``, ``capture/usdm_futures``, y también
    la propia carpeta) en orden alfabético estable, de modo que dos ejecuciones
    sobre la misma evidencia den exactamente el mismo informe. Si la carpeta no
    existe o no tiene CSV, devuelve una lista vacía; ``veredicto`` traducirá esa
    lista vacía en un ``UNKNOWN`` con su motivo, nunca en un PASS.
    """

    carpeta = Path(carpeta_capture)
    if not carpeta.is_dir():
        return []

    rutas: set[Path] = set()
    for patron in PATRONES_CSV:
        rutas.update(p for p in carpeta.rglob(patron) if p.is_file())

    series: list[Serie] = []
    for ruta in sorted(rutas, key=lambda p: str(p)):
        serie = analizar_csv(ruta, umbral_ms=umbral_ms)
        if serie is not None:
            series.append(serie)
    return series


def veredicto(series: list[Serie]) -> tuple[str, str]:
    """Traduce las series a ``(estado, motivo)``. El motivo nunca va vacío.

    Precedencia, y el porqué de cada escalón:

    - ``FAIL`` si alguna serie superó su umbral. Es la única afirmación positiva
      que este detector puede hacer: vio un escalón.
    - ``UNKNOWN`` si no hubo series, si ninguna fue legible, si **alguna** quedó
      por debajo de la resolución útil (menos de ``FILAS_MINIMAS_UTILES`` filas),
      si alguna quedó ilegible —la cobertura sería incompleta—, si se descartaron
      demasiadas filas, o si hubo deriva acumulada por encima del umbral sin un
      escalón único.
    - ``PASS`` solo si hubo al menos una serie con filas suficientes, todas
      legibles y ninguna sospechosa. Y aun ese PASS lleva escrito en su motivo
      que no demuestra la ausencia de saltos.
    """

    if not series:
        return DESCONOCIDO, (
            "no se analizó ninguna serie: no se encontró ningún CSV de eventos "
            "legible en la ruta indicada. " + NO_DEMUESTRA
        )

    sospechosas = [s for s in series if s.sospechoso]
    if sospechosas:
        detalle = "; ".join(
            f"{s.mercado} ({s.ruta.name}): mayor salto {_ms(s.mayor_salto_ms)} ms "
            f"sobre un umbral de {_ms(s.umbral_ms)} ms"
            for s in sospechosas
        )
        return FAIL, (
            f"{len(sospechosas)} de {len(series)} series presentan una "
            f"discontinuidad del reloj de pared por encima del umbral: {detalle}"
        )

    hallazgos = Hallazgos()
    for serie in series:
        if not serie.medida:
            hallazgos.anotar(f"{serie.ruta.name}: {serie.motivo_ilegible}")
        elif not serie.suficiente:
            # Una serie corta NO se puede tapar con las demás. Si contado trae
            # 400.000 filas y futuros solo 10, la ventana de futuros no se
            # observó, y un PASS global la daría por observada: eso sería
            # exactamente fabricar un PASS sobre algo que no se midió.
            hallazgos.anotar(
                f"{serie.ruta.name}: solo {serie.filas} filas legibles, "
                f"por debajo del mínimo de {FILAS_MINIMAS_UTILES} para afirmar nada"
            )

    suficientes = [s for s in series if s.suficiente]
    if not suficientes:
        return DESCONOCIDO, (
            "ninguna serie alcanza la resolución útil: " + hallazgos.texto()
            + ". " + NO_DEMUESTRA
        )

    for serie in suficientes:
        if serie.cobertura_dudosa:
            hallazgos.anotar(
                f"{serie.ruta.name}: se descartaron {serie.filas_descartadas} filas "
                f"de {serie.filas + serie.filas_descartadas}, cobertura insuficiente"
            )
        if serie.deriva_sin_escalon:
            hallazgos.anotar(
                f"{serie.ruta.name}: rango de {_ms(serie.rango_ms)} ms por encima del "
                f"umbral de {_ms(serie.umbral_ms)} ms sin ningún escalón único; el "
                "detector no distingue un ajuste gradual de un escalón repartido"
            )

    if hallazgos:
        return DESCONOCIDO, (
            "no se puede afirmar nada sobre el reloj de pared: "
            + hallazgos.texto()
            + ". "
            + NO_DEMUESTRA
        )

    filas = sum(s.filas for s in suficientes)
    umbral = max(s.umbral_ms for s in suficientes)
    return PASS, (
        f"{len(suficientes)} series y {_miles(filas)} filas recorridas sin ninguna "
        f"discontinuidad por encima de {_ms(umbral)} ms. " + NO_DEMUESTRA
    )


def _ms(valor: float) -> str:
    """Milisegundos con coma decimal, como el resto de los textos del proyecto."""

    return f"{valor:.3f}".replace(".", ",")


def _miles(valor: int) -> str:
    """Entero con punto de millar, como el resto de los textos del proyecto."""

    return f"{valor:,}".replace(",", ".")


def informe_texto(series: list[Serie]) -> str:
    """Informe legible para Jean, que no es programador.

    Incluye siempre, y sin letra pequeña, lo que este detector no demuestra.
    """

    estado, motivo = veredicto(series)
    lineas: list[str] = []
    lineas.append("DETECTOR DE SALTOS DEL RELOJ DE PARED — JEAN_FLOW 555 META_QUANT")
    lineas.append("=" * 72)
    lineas.append("")
    lineas.append(f"VEREDICTO: {estado}")
    lineas.append(f"MOTIVO   : {motivo}")
    lineas.append("")
    lineas.append(
        "Qué se mide: D = receive_time_utc_ns - receive_time_monotonic_ns en cada"
    )
    lineas.append(
        "fila. Las dos marcas se toman en líneas consecutivas del motor, así que D"
    )
    lineas.append(
        "es constante salvo la cuantización del cronómetro. Un movimiento del reloj"
    )
    lineas.append("de pared durante la captura aparece como un escalón en D.")
    lineas.append("")

    if not series:
        lineas.append("No se analizó ninguna serie.")
    else:
        lineas.append(f"SERIES ANALIZADAS: {len(series)}")
        lineas.append("-" * 72)
    for serie in series:
        lineas.append(f"  [{serie.mercado}] {serie.ruta.name}")
        lineas.append(f"      ruta                : {serie.ruta}")
        if not serie.medida:
            lineas.append(f"      NO SE PUDO MEDIR    : {serie.motivo_ilegible}")
            lineas.append("      resultado           : UNKNOWN para esta serie")
            lineas.append("")
            continue
        lineas.append(f"      filas legibles      : {_miles(serie.filas)}")
        if serie.filas_descartadas:
            lineas.append(
                f"      filas descartadas   : {_miles(serie.filas_descartadas)} "
                "(corruptas o sin las dos marcas)"
            )
        lineas.append(f"      rango de D          : {_ms(serie.rango_ms)} ms")
        lineas.append(f"      mayor salto entre filas: {_ms(serie.mayor_salto_ms)} ms")
        lineas.append(f"      umbral aplicado     : {_ms(serie.umbral_ms)} ms")
        if serie.paso_muestreo > 1:
            lineas.append(
                f"      mediana de D        : {serie.mediana_ns} ns "
                f"(MUESTREADA: una de cada {serie.paso_muestreo} filas)"
            )
        else:
            lineas.append(f"      mediana de D        : {serie.mediana_ns} ns (exacta)")
        if serie.sospechoso:
            lineas.append(
                "      resultado           : SOSPECHOSO, escalón por encima del umbral"
            )
        elif not serie.suficiente:
            # Sin esta línea, Jean leería «sin discontinuidad» junto a un
            # veredicto UNKNOWN y no entendería de dónde sale la contradicción.
            lineas.append(
                f"      resultado           : demasiado pocas filas para afirmar nada "
                f"(hacen falta {FILAS_MINIMAS_UTILES})"
            )
        elif serie.deriva_sin_escalon:
            lineas.append(
                "      resultado           : rango por encima del umbral sin escalón único"
            )
        elif serie.cobertura_dudosa:
            lineas.append(
                "      resultado           : cobertura dudosa por exceso de descartes"
            )
        else:
            lineas.append(
                "      resultado           : sin discontinuidad por encima del umbral"
            )
        lineas.append("")

    lineas.append("-" * 72)
    lineas.append("LO QUE ESTE RESULTADO NO DICE")
    lineas.append("")
    lineas.append(NO_DEMUESTRA)
    lineas.append("")
    for numero, limitacion in enumerate(LIMITACIONES, start=1):
        lineas.append(f"  {numero}. {limitacion}")
    lineas.append("")
    lineas.append(
        "Un PASS de esta herramienta significa «no encontré ningún salto por encima"
    )
    lineas.append("de mi resolución», nunca «no hubo ningún salto».")
    return "\n".join(lineas)


def informe_json(series: list[Serie]) -> dict[str, Any]:
    """Artefacto JSON del detector, listo para ``escribir_json_atomico``.

    Los campos numéricos de una serie ilegible salen como ``null`` a propósito:
    un cero se leería como una medición y aquí no hubo ninguna.
    """

    estado, motivo = veredicto(series)
    detalle: list[dict[str, Any]] = []
    for serie in series:
        medido = serie.medida
        detalle.append(
            {
                "ruta": str(serie.ruta),
                "archivo": serie.ruta.name,
                "mercado": serie.mercado,
                "medida": medido,
                "motivo_ilegible": serie.motivo_ilegible,
                "filas": serie.filas if medido else None,
                "filas_descartadas": serie.filas_descartadas if medido else None,
                "rango_ms": round(serie.rango_ms, 6) if medido else None,
                "mayor_salto_ms": round(serie.mayor_salto_ms, 6) if medido else None,
                "mediana_ns": serie.mediana_ns if medido else None,
                "mediana_muestreada": (serie.paso_muestreo > 1) if medido else None,
                "paso_muestreo": serie.paso_muestreo if medido else None,
                "umbral_ms": round(serie.umbral_ms, 6),
                # Los tres juicios siguientes salen como ``null`` cuando la serie
                # no se pudo medir: un ``false`` en "sospechoso" se leería como
                # «se miró y estaba limpia», y aquí no se miró nada.
                "sospechoso": serie.sospechoso if medido else None,
                "filas_minimas_utiles": FILAS_MINIMAS_UTILES,
                "suficiente": serie.suficiente if medido else None,
                "deriva_sin_escalon": serie.deriva_sin_escalon if medido else None,
                "cobertura_dudosa": serie.cobertura_dudosa if medido else None,
            }
        )

    return {
        "herramienta": "detector_saltos",
        "version": VERSION_DETECTOR,
        "generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "estado": estado,
        "motivo": motivo,
        "metodo": (
            "D = receive_time_utc_ns - receive_time_monotonic_ns por fila; se "
            "busca un escalón en D, que es la huella de un movimiento del reloj "
            "de pared durante la captura."
        ),
        "cuanto_windows_ms": CUANTO_WINDOWS_MS,
        "factor_umbral": FACTOR_UMBRAL,
        "umbral_por_omision_ms": UMBRAL_POR_OMISION_MS,
        "no_demuestra": NO_DEMUESTRA,
        "limitaciones": list(LIMITACIONES),
        "series_analizadas": len(series),
        "series": detalle,
    }


def _ruta_de_salida_permitida(destino: Path) -> None:
    """Impide escribir dentro de ``runs/``. Regla 1: evidencia intocable."""

    partes = {parte.lower() for parte in destino.resolve().parts}
    if "runs" in partes:
        raise ValueError(
            "la salida no puede escribirse dentro de runs/: esa carpeta es "
            "evidencia de solo lectura. Elija un destino fuera del árbol de "
            "corridas."
        )


def _main(argumentos: Iterable[str] | None = None) -> int:
    """Punto de entrada de línea de órdenes. Solo lee evidencia.

    Códigos de salida, con la misma distinción que el resto del proyecto entre
    «no pude mirar» y «miré y salió mal»:

    ==  =========================================================
    0   PASS: no se encontró ninguna discontinuidad sobre el umbral
    1   UNKNOWN: no se pudo afirmar nada, y el motivo va impreso
    2   error de uso (umbral inválido, destino prohibido, no se pudo escribir)
    3   FAIL: se vio un escalón por encima del umbral
    ==  =========================================================

    Ningún error de uso sale como rastro de excepción: este proyecto ya sabe lo
    que cuesta entregarle a Jean un ``Traceback`` en vez de una frase (el propio
    ``audit_metrics.json`` de la sesión d64fea5560ac es un rastro de excepción).
    """

    analizador = argparse.ArgumentParser(
        prog="detector_saltos",
        description=(
            "Busca saltos del reloj de pared en los CSV ya capturados. NO "
            "demuestra que no hubiera saltos: solo informa de si encontró "
            "discontinuidades por encima de su umbral."
        ),
    )
    analizador.add_argument(
        "capture", type=Path, help="carpeta capture/ de una corrida (se lee, no se toca)"
    )
    analizador.add_argument(
        "--umbral-ms",
        type=float,
        default=None,
        help=f"umbral en milisegundos (por omisión {UMBRAL_POR_OMISION_MS})",
    )
    analizador.add_argument(
        "--salida",
        type=Path,
        default=None,
        help="ruta del JSON a escribir, obligatoriamente FUERA de runs/",
    )
    opciones = analizador.parse_args(list(argumentos) if argumentos is not None else None)

    # El destino se valida ANTES de recorrer cientos de megabytes: si la ruta
    # está prohibida, Jean se entera en el primer segundo y no al final.
    if opciones.salida is not None:
        try:
            _ruta_de_salida_permitida(opciones.salida)
        except ValueError as exc:
            print(f"No escribí nada. {exc}", file=sys.stderr)
            return 2

    try:
        series = analizar_captura(opciones.capture, umbral_ms=opciones.umbral_ms)
    except ValueError as exc:
        print(f"No puedo usar ese umbral: {exc}", file=sys.stderr)
        return 2

    print(informe_texto(series))

    if opciones.salida is not None:
        try:
            escribir_json_atomico(opciones.salida, informe_json(series))
        except OSError as exc:
            print(f"\nNo se pudo escribir el informe JSON: {exc}", file=sys.stderr)
            return 2
        print(f"\nInforme JSON escrito en: {opciones.salida}")

    estado, _ = veredicto(series)
    return {PASS: 0, DESCONOCIDO: 1, FAIL: 3}[estado]


if __name__ == "__main__":  # pragma: no cover - envoltura de línea de órdenes
    sys.exit(_main())
