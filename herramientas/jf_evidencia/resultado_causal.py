"""Emisión de ``RESULTADO_CAUSAL.json``: los tres veredictos, por separado.

POR QUÉ EXISTE ESTE MÓDULO
--------------------------
Hoy la corrida termina con un booleano: ``RESULT.pass``. Ese booleano combina
por «y» lógico cosas que no tienen la misma naturaleza — la integridad causal
de los datos, el rendimiento del proceso y la calidad del reloj de pared —, de
modo que basta con que una de ellas no se pueda ni siquiera medir para que toda
la captura quede marcada como fallida, sin decir por qué.

El caso real que obliga a corregirlo es la sesión ``d64fea5560ac``: su
``audit_metrics.json`` no es un informe, es un rastro de excepción de Python
(``UnicodeEncodeError`` de cp1252 al imprimir el informe en una consola
Windows). Es decir: el informe de rendimiento **no se pudo leer**. Eso no es
un fallo de rendimiento, y mucho menos un fallo de causalidad. Sin embargo, el
gate agregado lo convirtió en un `pass=false` global e indistinguible.

Este módulo NO corrige el gate: no toca ``RESULT.json``, no lo reescribe, no lo
reinterpreta y no lo sustituye. Emite **al lado** un artefacto adicional con los
tres veredictos publicados por separado, cada uno con su motivo cuando no es
``PASS``. Deliberadamente **no hay ningún booleano agregado** en la salida:
cualquier consumidor que quiera un sí o un no debe declarar por escrito qué
combinación de los tres usa. El booleano agregado es precisamente el defecto
que se está corrigiendo, así que reintroducirlo aquí sería reproducirlo.

Especificación: informe v3, sección 6.2.

LO QUE ESTE MÓDULO NO HACE, POR DISEÑO
--------------------------------------
- No abre ``RESULT.json`` en modo escritura, ni lo renombra, ni lo borra.
- No lee ni escribe ``CAPTURA_COMPLETA_AUDITADA.json``. Ni siquiera lo consulta:
  ese archivo conserva exactamente su significado y su condición de emisión
  actuales, y ``RESULTADO_CAUSAL.json`` no abre la puerta de ``ML-F2`` (6.4).
- No mueve ningún umbral. Los cinco vigentes están escritos abajo tal cual y
  se evalúan contra ESOS valores, no contra los que el informe de métricas
  declare llevar: un informe producido con un límite relajado no puede comprar
  un ``PASS`` aquí.
- No emite un artefacto incompleto. Un artefacto ausente es un resultado
  honesto; uno incompleto es una trampa.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .comun import (
    DESCONOCIDO,
    ErrorEvidencia,
    FAIL,
    Hallazgos,
    PASS,
    escribir_json_atomico,
    leer_json,
    numero_finito,
)

# --------------------------------------------------------------------------
# Identidad del artefacto y de la política
# --------------------------------------------------------------------------

# Versión propia del artefacto, independiente del esquema 2.0.0 del CSV.
ESQUEMA = "1.0.0"

# Identificador de la política de evaluación. Cambiar cualquiera de los
# criterios de abajo OBLIGA a cambiar este valor: es lo único que permite a un
# auditor saber con qué regla se emitió un artefacto ya archivado.
POLITICA = "causal-v1"

NOMBRE_ARTEFACTO = "RESULTADO_CAUSAL.json"
NOMBRE_RESULT = "RESULT.json"

# Ruta relativa del informe de métricas dentro de la corrida.
RUTA_METRICAS = ("capture", "audit_metrics.json")

# Nombres que este módulo se niega a escribir aunque se lo pidan por parámetro.
# La regla 1 del proyecto es «solo lectura sobre runs/»: el único archivo que
# esta herramienta crea es el suyo propio.
NOMBRES_INTOCABLES = frozenset(
    {
        "RESULT.json",
        "CAPTURA_COMPLETA_AUDITADA.json",
        "postflight.json",
        "session.json",
        "READY.json",
        "clock_preflight.json",
    }
)

# --------------------------------------------------------------------------
# Los cinco umbrales vigentes. NO SE MUEVEN NUNCA.
# --------------------------------------------------------------------------
# Clave: nombre del gate tal y como lo publica ``audit_metrics.json``
# (audit.py:935-964). Valor: (nombre de la métrica, límite p99 en ms).
# Las cinco métricas son de reloj MONOTÓNICO: son duraciones locales, no
# dependen del reloj de pared y por eso pueden ser gate. Las de reloj cruzado
# (exchange_to_receive_depth, exchange_to_receive_trade, trade_time_to_receive)
# NO pueden serlo y no aparecen aquí ni pueden aparecer.
UMBRALES_P99_MS: dict[str, tuple[str, float]] = {
    "parse_p99": ("parse", 5.0),
    "book_apply_p99": ("book_apply", 5.0),
    "book_pipeline_p99": ("book_pipeline_total", 5.0),
    "event_loop_lag_p99": ("event_loop_lag", 40.0),
    "writer_yield_p99": ("writer_cooperative_yield", 5.0),
}

# Dominio de reloj exigido a toda métrica que actúe como gate.
DOMINIO_EXIGIDO = "monotonic"

# Claves de ``audit.checks`` que no son un mercado.
CHECK_IDENTIDAD = "identity"
CHECK_COMPROMISO = "capture_commitment"

# ``metrics`` se EXCLUYE a propósito de la integridad causal: su resultado se
# publica por separado en ``monotonic_performance``. Ese desacople es la razón
# de ser de este artefacto. En la sesión d64fea5560ac ese check vale ``false``
# únicamente porque el informe no se pudo escribir en cp1252, y dejarlo dentro
# de la integridad causal volvería a mezclar «no pude mirar» con «miré y salió
# mal», que es exactamente la confusión que se está corrigiendo.
CHECK_RENDIMIENTO = "metrics"

CHECKS_NO_MERCADO = frozenset({CHECK_IDENTIDAD, CHECK_COMPROMISO, CHECK_RENDIMIENTO})

# Motivo fijo del hueco UTC. La sección 6.3 deja el certificado de UTC
# calificada DISEÑADO Y DOCUMENTADO, SIN IMPLEMENTAR, hasta que exista un
# consumidor concreto que lo necesite: hoy no hay ninguna fuente externa con la
# que cruzar por marca de tiempo. Un UNKNOWN declarado es un resultado
# legítimo; un PASS fabricado sería una mentira, y un FAIL sería negar algo que
# no se ha medido. En esta entrega este veredicto NUNCA puede negar nada.
MOTIVO_UTC = (
    "no se implementa el certificado UTC calificado hasta que exista un "
    "consumidor concreto (informe v3, sección 6.3)"
)


@dataclass(frozen=True, slots=True)
class Veredictos:
    """Los tres veredictos, independientes entre sí.

    No hay aquí ningún campo que los resuma, ni ningún booleano: quien quiera
    un sí o un no debe declarar por escrito su propia combinación.
    """

    causal_integrity: str
    monotonic_performance: str
    monotonic_performance_reason: str
    utc_quality: str
    utc_quality_reason: str


# --------------------------------------------------------------------------
# Utilidades locales de lectura estricta
# --------------------------------------------------------------------------


def _es_verdadero(valor: Any) -> bool:
    """True solo si el valor es exactamente ``True``.

    Se exige identidad y no verdad «al estilo Python» para que un ``1``, una
    cadena no vacía o un objeto cualquiera jamás valgan como aprobación.
    """

    return valor is True


def _es_cero(valor: Any) -> bool:
    """True solo si el valor es el entero 0. Rechaza ``False`` a propósito.

    En Python ``False == 0``: sin esta comprobación, un ``engine_exit_code``
    corrupto con valor ``false`` se leería como «terminó bien».
    """

    return isinstance(valor, int) and not isinstance(valor, bool) and valor == 0


def _entero(valor: Any) -> int | None:
    """Devuelve el entero, o None si no lo es. ``bool`` no es un entero aquí."""

    if isinstance(valor, bool) or not isinstance(valor, int):
        return None
    return valor


def _objeto(datos: dict[str, Any], clave: str) -> dict[str, Any] | None:
    """Sub-objeto de un dict, o None si falta o no es un objeto."""

    valor = datos.get(clave)
    return valor if isinstance(valor, dict) else None


# --------------------------------------------------------------------------
# Veredicto 1: integridad causal
# --------------------------------------------------------------------------


def _evaluar_causal(result: dict[str, Any]) -> tuple[str, Hallazgos]:
    """PASS o FAIL sobre los gates de datos e integridad. Nunca UNKNOWN.

    Este veredicto no admite UNKNOWN por especificación: si el ``RESULT.json``
    es legible, todo lo que hace falta para decidirlo está dentro; y si no lo
    es, no se emite el artefacto en absoluto. Por eso una pieza AUSENTE del
    ``RESULT.json`` es FAIL y no un estado intermedio: no se puede afirmar la
    integridad de lo que no se ha podido comprobar, y aquí la única alternativa
    a afirmarla es negarla.

    Se exige explícitamente, y por separado:

    - ``engine_exit_code == 0`` — el motor terminó por su propio pie.
    - ``session_manifest_validation.pass is True`` — el estado terminal durable
      del motor se validó, en vez de confiar en el código de salida.
    - ``interrupted is False`` — una captura interrumpida no es causalmente
      completa aunque todo lo demás cuadre.
    - Cada mercado: su check de diario y su ``replay_determinism`` en PASS.
    - Identidad y compromiso de captura en PASS, sin errores de compromiso.
    - Ningún archivo ``.partial``.

    Omitir ``engine_exit_code`` o ``session_manifest_validation`` abriría un
    camino de aprobación accidental (un motor caído a mitad con los diarios ya
    cerrados), así que ambos son requisito nombrado, no derivado.

    El check ``metrics`` queda FUERA a propósito: se publica en
    ``monotonic_performance``. Con esa única excepción, este conjunto es más
    estricto que ``data_gates_pass``, no más laxo. El porqué de un FAIL no se
    copia al artefacto: vive en el propio ``RESULT.json``
    (``audit.checks``, ``audit.replay_determinism``), que es donde un auditor
    debe mirar y que este módulo no reescribe.
    """

    hallazgos = Hallazgos()

    if not _es_cero(result.get("engine_exit_code")):
        hallazgos.anotar(
            f"engine_exit_code = {result.get('engine_exit_code')!r}, se exige 0"
        )

    validacion = _objeto(result, "session_manifest_validation")
    if validacion is None:
        hallazgos.anotar("falta session_manifest_validation")
    elif not _es_verdadero(validacion.get("pass")):
        codigo = validacion.get("error_code")
        hallazgos.anotar(f"session_manifest_validation no pasó (error_code={codigo!r})")

    if result.get("interrupted") is not False:
        hallazgos.anotar(f"interrupted = {result.get('interrupted')!r}, se exige false")

    auditoria = _objeto(result, "audit")
    if auditoria is None:
        hallazgos.anotar("falta el bloque audit")
        return FAIL, hallazgos

    checks = _objeto(auditoria, "checks")
    if not checks:
        hallazgos.anotar("audit.checks está vacío o ausente")
        return FAIL, hallazgos

    for nombre in (CHECK_IDENTIDAD, CHECK_COMPROMISO):
        if nombre not in checks:
            hallazgos.anotar(f"audit.checks no declara {nombre}")
        elif not _es_verdadero(checks[nombre]):
            hallazgos.anotar(f"audit.checks.{nombre} = {checks[nombre]!r}")

    mercados = sorted(clave for clave in checks if clave not in CHECKS_NO_MERCADO)
    if not mercados:
        hallazgos.anotar("audit.checks no declara ningún mercado")

    determinismo = _objeto(auditoria, "replay_determinism") or {}
    for mercado in mercados:
        if not _es_verdadero(checks[mercado]):
            hallazgos.anotar(f"audit.checks.{mercado} = {checks[mercado]!r}")
        entrada = determinismo.get(mercado)
        if not isinstance(entrada, dict):
            hallazgos.anotar(f"falta replay_determinism.{mercado}")
            continue
        if not _es_verdadero(entrada.get("pass")):
            error = entrada.get("error")
            detalle = f" ({error})" if isinstance(error, str) and error else ""
            hallazgos.anotar(f"replay_determinism.{mercado} no pasó{detalle}")

    compromiso = _objeto(auditoria, CHECK_COMPROMISO)
    if compromiso is None:
        hallazgos.anotar("falta audit.capture_commitment")
    else:
        if not _es_verdadero(compromiso.get("pass")):
            hallazgos.anotar("audit.capture_commitment no pasó")
        errores = compromiso.get("errors")
        if not isinstance(errores, list):
            hallazgos.anotar("audit.capture_commitment.errors no es una lista")
        elif errores:
            hallazgos.anotar(f"audit.capture_commitment.errors: {len(errores)} error(es)")

    parciales = auditoria.get("partial_files")
    if not isinstance(parciales, list):
        hallazgos.anotar("audit.partial_files no es una lista")
    elif parciales:
        hallazgos.anotar(f"quedaron {len(parciales)} archivo(s) .partial")

    return (FAIL if hallazgos else PASS), hallazgos


# --------------------------------------------------------------------------
# Veredicto 2: rendimiento monotónico
# --------------------------------------------------------------------------


def _evaluar_umbral(
    mercado: str,
    gate: str,
    metrica: str,
    limite_ms: float,
    entrada: Any,
    fallos: Hallazgos,
    dudas: Hallazgos,
    avisos: Hallazgos,
) -> None:
    """Evalúa un único gate p99 contra el límite VIGENTE, no contra el declarado.

    Reparte el resultado en tres cubos distintos a propósito: un exceso medido
    (``fallos``) es un hecho; una métrica que no se pudo medir (``dudas``) no lo
    es; y una discrepancia de política (``avisos``) se declara sin cambiar el
    veredicto. Mezclarlos es el error que este artefacto corrige.
    """

    etiqueta = f"{mercado}/{metrica}"

    if not isinstance(entrada, dict):
        dudas.anotar(f"{etiqueta}: el informe no publica el umbral {gate}")
        return

    dominio = entrada.get("clock_domain")
    if dominio is not None and dominio != DOMINIO_EXIGIDO:
        # Una métrica de reloj cruzado NO puede ser gate. Si el informe declara
        # otro dominio, no se evalúa: no se aprueba ni se condena con ella.
        dudas.anotar(
            f"{etiqueta}: el informe la declara en dominio de reloj {dominio!r}; "
            f"solo {DOMINIO_EXIGIDO!r} puede ser gate"
        )
        return

    if entrada.get("present") is not True:
        dudas.anotar(f"{etiqueta}: ausente del informe (present={entrada.get('present')!r})")
        return

    valor = entrada.get("worst_value_ms")
    if not numero_finito(valor):
        dudas.anotar(f"{etiqueta}: worst_value_ms = {valor!r}, no es un número finito")
        return

    muestras = _entero(entrada.get("sample_count"))
    minimo = _entero(entrada.get("min_samples"))
    if muestras is None:
        dudas.anotar(f"{etiqueta}: el informe no declara sample_count")
        return
    if minimo is None:
        dudas.anotar(f"{etiqueta}: el informe no declara min_samples")
        return
    if muestras < minimo:
        # Falta de muestras: UNKNOWN, jamás PASS. Un p99 con n pequeño puede
        # ocultar el pico que importa.
        dudas.anotar(f"{etiqueta}: muestras insuficientes ({muestras} < {minimo})")
        return

    limite_declarado = entrada.get("limit_ms")
    if numero_finito(limite_declarado) and float(limite_declarado) != limite_ms:
        avisos.anotar(
            f"{etiqueta}: el informe declara limit_ms={float(limite_declarado)}; "
            f"se evalúa contra el vigente {limite_ms} ms"
        )

    if float(valor) > limite_ms:
        fallos.anotar(
            f"{etiqueta}: p99 {float(valor)} ms supera el límite vigente {limite_ms} ms"
        )


def _evaluar_rendimiento(informe: Any, motivo_lectura: str | None) -> tuple[str, str]:
    """Los cinco umbrales sobre métricas monotónicas.

    Reglas, en este orden:

    1. Si el informe no se pudo leer, es UNKNOWN con ese motivo, **no FAIL**.
       Es el caso real de la sesión d64fea5560ac, cuyo ``audit_metrics.json``
       contiene un rastro de excepción: no medir no es medir mal.
    2. Un exceso medido manda sobre una duda: si alguna métrica supera su
       límite vigente, el veredicto es FAIL aunque otra métrica no se haya
       podido evaluar. Un pico observado no se borra porque falte otro dato.
    3. Si no hay ningún exceso pero algo no se pudo evaluar, es UNKNOWN.
    4. Solo si las cinco métricas de todos los mercados se midieron y ninguna
       superó su límite, es PASS.
    """

    if informe is None:
        return DESCONOCIDO, f"no se pudo leer el informe de métricas: {motivo_lectura}"

    fallos = Hallazgos()
    dudas = Hallazgos()
    avisos = Hallazgos()

    mal_formadas = _entero(informe.get("malformed_json_lines"))
    if mal_formadas is None:
        dudas.anotar("el informe no declara malformed_json_lines")
    elif mal_formadas > 0:
        # Líneas ilegibles del diario de métricas = ventanas perdidas. La base
        # de muestras deja de ser completa, así que no se puede afirmar un PASS.
        dudas.anotar(
            f"el diario de métricas tiene {mal_formadas} línea(s) mal formada(s): "
            "la base de muestras está incompleta"
        )

    ausentes = informe.get("missing_markets")
    if isinstance(ausentes, list) and ausentes:
        dudas.anotar(f"faltan muestras de mercados exigidos: {', '.join(map(str, ausentes))}")

    mercados = informe.get("markets")
    if not isinstance(mercados, dict) or not mercados:
        return DESCONOCIDO, "el informe de métricas no publica ningún mercado"

    for mercado in sorted(mercados):
        bloque = mercados[mercado]
        if not isinstance(bloque, dict):
            dudas.anotar(f"{mercado}: la sección del mercado no es un objeto")
            continue
        umbrales = bloque.get("thresholds")
        if not isinstance(umbrales, dict):
            dudas.anotar(f"{mercado}: el informe no publica la sección thresholds")
            continue
        for gate, (metrica, limite_ms) in UMBRALES_P99_MS.items():
            _evaluar_umbral(
                mercado, gate, metrica, limite_ms, umbrales.get(gate), fallos, dudas, avisos
            )

    if fallos:
        partes = [fallos.texto()]
        if avisos:
            partes.append(avisos.texto())
        return FAIL, "; ".join(partes)
    if dudas:
        partes = [dudas.texto()]
        if avisos:
            partes.append(avisos.texto())
        return DESCONOCIDO, "; ".join(partes)
    return PASS, avisos.texto()


# --------------------------------------------------------------------------
# API pública
# --------------------------------------------------------------------------


def evaluar(run_dir: Path) -> tuple[Veredictos | None, str]:
    """Calcula los tres veredictos de una corrida.

    Devuelve ``(None, motivo)`` cuando no hay base para emitir nada: sin un
    ``RESULT.json`` legible no se puede copiar la identidad de la corrida ni
    decidir la integridad causal, y un artefacto con esos campos vacíos sería
    peor que no tenerlo.
    """

    run_dir = Path(run_dir)
    ruta_result = run_dir / NOMBRE_RESULT

    lectura = leer_json(ruta_result)
    if not lectura.ok or lectura.datos is None:
        return None, f"{NOMBRE_RESULT}: {lectura.motivo}"

    result = lectura.datos
    identidad = result.get("capture_session_id")
    if not isinstance(identidad, str) or not identidad:
        return None, f"{NOMBRE_RESULT} no declara capture_session_id"

    causal, _ = _evaluar_causal(result)

    lectura_metricas = leer_json(run_dir.joinpath(*RUTA_METRICAS))
    rendimiento, motivo_rendimiento = _evaluar_rendimiento(
        lectura_metricas.datos, lectura_metricas.motivo
    )

    return (
        Veredictos(
            causal_integrity=causal,
            monotonic_performance=rendimiento,
            monotonic_performance_reason=motivo_rendimiento,
            # El hueco UTC queda preparado y declarado, pero NO relleno.
            utc_quality=DESCONOCIDO,
            utc_quality_reason=MOTIVO_UTC,
        ),
        "",
    )


def _version_del_motor(result: dict[str, Any]) -> str | None:
    """Versión del motor tal y como la declaró la propia corrida.

    Se busca donde el motor la escribe (``ready`` y el manifiesto de sesión) y
    se devuelve ``None`` si no aparece. No se deduce del nombre de la carpeta
    ni del paquete instalado: eso sería inventar un dato.
    """

    candidatos: list[Any] = []
    ready = _objeto(result, "ready")
    if ready is not None:
        candidatos.append(ready.get("engine_version"))
    manifiesto = _objeto(result, "session_manifest")
    if manifiesto is not None:
        identidad = _objeto(manifiesto, "identity")
        if identidad is not None:
            candidatos.append(identidad.get("engine_version"))
        salud = _objeto(manifiesto, "health")
        if salud is not None:
            candidatos.append(salud.get("engine_version"))
    for candidato in candidatos:
        if isinstance(candidato, str) and candidato:
            return candidato
    return None


def _sello_de_entrada(ruta: Path, relativo: str, obligatorio: bool) -> str | None:
    """Sello SHA-256 de un archivo de entrada, o None si no existe.

    Distingue tres casos que no son el mismo:

    - No existe: no entra en ``inputs_sha256``. Si no es obligatorio, el
      veredicto que dependía de él ya dijo UNKNOWN con su motivo.
    - Existe y sus bytes se pudieron leer: entra, aunque su CONTENIDO no sea
      un JSON válido. El sello es del archivo tal cual está, que es lo que hay
      que poder citar después.
    - Existe y sus bytes NO se pudieron leer: se aborta la emisión. Sabemos que
      la evidencia está ahí y no la hemos podido sellar; emitir sin ese sello
      sería publicar un artefacto que no se puede verificar.
    """

    lectura = leer_json(ruta)
    if lectura.sha256 is not None:
        return lectura.sha256
    if not ruta.exists():
        if obligatorio:
            raise ErrorEvidencia(f"{relativo}: no existe")
        return None
    raise ErrorEvidencia(f"{relativo}: {lectura.motivo}")


def construir(run_dir: Path, veredictos: Veredictos, *, ahora_ns: int) -> dict[str, Any]:
    """Arma el diccionario del artefacto. Determinista dado ``ahora_ns``.

    ``ahora_ns`` se recibe como parámetro y no se toma de ``time.time_ns()``
    para que dos llamadas iguales produzcan exactamente el mismo diccionario y
    las pruebas puedan fijarlo.

    Lanza ``ErrorEvidencia`` si falta cualquier entrada obligatoria: la
    condición de emisión es «si y solo si», y hacerla cumplir aquí evita que
    ``emitir`` escriba nunca un archivo a medio poblar.
    """

    if isinstance(ahora_ns, bool) or not isinstance(ahora_ns, int):
        raise ValueError("ahora_ns debe ser un entero de nanosegundos")

    run_dir = Path(run_dir)
    ruta_result = run_dir / NOMBRE_RESULT

    lectura = leer_json(ruta_result)
    if not lectura.ok or lectura.datos is None:
        raise ErrorEvidencia(f"{NOMBRE_RESULT}: {lectura.motivo}")
    if lectura.sha256 is None:  # pragma: no cover - defensivo
        raise ErrorEvidencia(f"{NOMBRE_RESULT}: no se pudo sellar")

    result = lectura.datos
    identidad = result.get("capture_session_id")
    if not isinstance(identidad, str) or not identidad:
        raise ErrorEvidencia(f"{NOMBRE_RESULT} no declara capture_session_id")

    entradas: dict[str, str] = {NOMBRE_RESULT: lectura.sha256}

    relativo_metricas = "/".join(RUTA_METRICAS)
    sello_metricas = _sello_de_entrada(
        run_dir.joinpath(*RUTA_METRICAS), relativo_metricas, obligatorio=False
    )
    if sello_metricas is not None:
        entradas[relativo_metricas] = sello_metricas

    return {
        "schema_version": ESQUEMA,
        "policy": POLITICA,
        # Copiado, NO recalculado: la identidad de la corrida la declara el
        # motor y esta herramienta no está en posición de reescribirla.
        "capture_session_id": identidad,
        "causal_integrity": veredictos.causal_integrity,
        "monotonic_performance": veredictos.monotonic_performance,
        "monotonic_performance_reason": veredictos.monotonic_performance_reason,
        "utc_quality": veredictos.utc_quality,
        "utc_quality_reason": veredictos.utc_quality_reason,
        "inputs_sha256": dict(sorted(entradas.items())),
        "result_json_sha256": lectura.sha256,
        "emitted_utc_ns": ahora_ns,
        "engine_version": _version_del_motor(result),
    }


def emitir(
    run_dir: Path, *, ahora_ns: int, destino: Path | None = None
) -> tuple[Path | None, str]:
    """Escribe ``RESULTADO_CAUSAL.json`` junto al ``RESULT.json`` de la corrida.

    Devuelve ``(ruta, "")`` si se emitió, o ``(None, motivo)`` si no. El motivo
    se devuelve para que el llamante lo publique: la ausencia del artefacto es
    un resultado, y un resultado sin explicación no sirve de nada.

    ``destino`` permite escribir el artefacto en otro sitio (por ejemplo, al
    verificar evidencia que debe permanecer intacta). El nombre del destino se
    comprueba contra ``NOMBRES_INTOCABLES``: esta herramienta no sobrescribe
    evidencia ni aunque se lo pidan por parámetro.
    """

    run_dir = Path(run_dir)
    veredictos, motivo = evaluar(run_dir)
    if veredictos is None:
        return None, f"no se emite {NOMBRE_ARTEFACTO}: {motivo}"

    try:
        artefacto = construir(run_dir, veredictos, ahora_ns=ahora_ns)
    except ErrorEvidencia as exc:
        return None, f"no se emite {NOMBRE_ARTEFACTO}: {exc}"

    ruta = Path(destino) if destino is not None else run_dir / NOMBRE_ARTEFACTO
    if ruta.name in NOMBRES_INTOCABLES:
        return None, f"no se emite: {ruta.name} es evidencia intocable"

    try:
        escribir_json_atomico(ruta, artefacto)
    except OSError as exc:
        return None, f"no se pudo escribir {ruta}: {exc}"

    return ruta, ""
