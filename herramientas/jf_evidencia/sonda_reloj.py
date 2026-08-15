"""Sonda de reloj multi-muestra sobre SNTP, en proceso y sin privilegios.

QUÉ MIDE, Y POR QUÉ EXISTE
==========================

Mide el desvío del reloj de pared local contra varios servidores de tiempo
públicos, con muchas muestras, y **publica la banda que esa medición demuestra**.

Existe por un fallo concreto y comprobado del gate vigente del producto, que hay
que tener delante para entender cada decisión de este módulo:

- El gate toma **una sola observación**. `launcher.py:1138` y `:1271` lo invocan
  con `-Samples 20`, `Test-ClockSync.ps1:50-51` reenvía **solo** `-WarnMs`, y el
  bloque de parámetros de `Test-W32Time.ps1:3-6` declara **solo** `$WarnMs`.
  El `20` se descarta en silencio.
- En campo aprobó con 17,478 ms:
  `runs/preflight_20260814T081121_393783Z/clock_preflight.json` trae
  `"abs_phase_offset_ms": 17.4779`, `"offset_observations": 1`, `"pass": true`,
  `"error_code": "PASS"`, `"warn_ms": 50`.
- **El mismo archivo**, en su bloque `status`, declara
  `Demora de raíz: 0.1299577s` y `Dispersión de raíz: 0.0801773s`. Es decir, la
  propia cadena que aprobó anunciaba una distancia de raíz de
  0,1299577/2 + 0,0801773 = **0,14516 s**, unos **±145 ms**, mientras el gate
  concluía exactitud dentro de ±50 ms a partir del 17,5 ms aislado.

Ese 17,5 ms es el residuo que un lazo de control cree tener, no una cota de
exactitud. Cualquier medición multi-muestra que publique su banda es mejor
evidencia que aquello, y eso es exactamente lo que hace este módulo.

EL CRITERIO, QUE ES LO CENTRAL
==============================

El veredicto **no** es ``|offset| <= límite``. Es::

    |offset estimado| + incertidumbre certificable <= límite declarado

La incertidumbre certificable es **propia de cada fuente y no se hereda entre
fuentes** (informe v3, sección 6.3). Para SNTP, la magnitud adecuada es::

    incertidumbre = distancia_de_raíz + delta/2
                  = (root_delay/2 + root_dispersion) + (T4-T1 - (T3-T2))/2

Los dos sumandos miden cosas distintas y por eso se suman:

- **Distancia de raíz** (RFC 5905, §11.2): lo que el propio servidor declara que
  vale su cadena hasta el reloj de referencia. Es su incertidumbre heredada, y
  el servidor la publica en el paquete: no hay que suponerla.
- **delta/2**: la asimetría máxima posible del camino de ida y vuelta de **esta**
  muestra. Es la misma cota que el motor ya usa contra Binance
  (`rest.py:217-267`, que documenta ``|θ − θ̂| ≤ δ/2``), aplicada aquí sobre el
  viaje real y no sobre el viaje completo, porque SNTP sí da las cuatro marcas
  de verdad y permite descontar el tiempo que el servidor tardó en contestar.

Con este criterio, el caso de campo habría sido honesto: 17,5 + 145 = 162,5 ms
contra un límite de 50 ms es **FAIL**, o **UNKNOWN** si la banda no se puede
medir. Nunca PASS.

QUÉ NO HACE
===========

No disciplina el reloj, no lo escribe, no lo ajusta y **no necesita permisos de
administrador**: usa un puerto de origen efímero, que ningún sistema restringe.
Es un **instrumento de medida**, no un lazo de control; para lo segundo el
proyecto ya decidió chronyd (informe v3, sección 5). No lee ni escribe nada de
``runs/``. No importa nada fuera de la biblioteca estándar. Y no fabrica un
PASS: sin cuórum, sin banda o con fuentes que se contradicen, el veredicto es
``UNKNOWN`` con su motivo escrito.

LIMITACIONES CONOCIDAS, DECLARADAS AQUÍ Y EN LA SALIDA
======================================================

1. Mide **un instante**, el de la sonda. No dice nada de lo que el reloj hizo
   durante una captura; para eso está ``detector_saltos.py``.
2. Si UDP/123 está bloqueado —cortafuegos, hotel, oficina—, no hay medición:
   el resultado es ``UNKNOWN`` por falta de cuórum, jamás un PASS por omisión.
3. La resolución de nombres la hace el sistema operativo y **no** respeta el
   ``timeout_s`` de esta sonda: con DNS caído, la primera consulta puede tardar
   lo que tarde el resolutor.
4. Un servidor puede mentir. Por eso se exige cuórum de dos y se comprueba que
   las fuentes se solapen dentro de sus bandas; lo que no se puede es detectar
   un error común a todas ellas.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import struct
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from .comun import (
    DESCONOCIDO,
    FAIL,
    PASS,
    ErrorEvidencia,
    Hallazgos,
    escribir_json_atomico,
)

__all__ = [
    "PUERTO_NTP",
    "EPOCA_NTP",
    "SERVIDORES_POR_DEFECTO",
    "LIMITE_POR_OMISION_MS",
    "QUORUM_MINIMO",
    "TAMANO_PAQUETE",
    "CRITERIO",
    "NO_DEMUESTRA",
    "LIMITACIONES",
    "ErrorSonda",
    "Muestra",
    "Resultado",
    "construir_peticion",
    "descifrar_respuesta",
    "consultar",
    "mejores_por_servidor",
    "medir",
    "informe_texto",
    "informe_json",
    "escribir_informe",
    "escribir_muestras_jsonl",
]

VERSION_SONDA = "1.0.0"

PUERTO_NTP = 123
EPOCA_NTP = 2208988800  # segundos entre 1900-01-01 y 1970-01-01

# Tres operadores distintos a propósito: un cuórum entre tres nombres del mismo
# operador no sería un cuórum, sería la misma opinión repetida.
SERVIDORES_POR_DEFECTO = ("pool.ntp.org", "time.cloudflare.com", "time.google.com")

# Límite por omisión. Es el mismo `warn_ms` que el preflight de campo ya usaba
# (`clock_preflight.json`: "warn_ms": 50), para que los números sean comparables.
# El límite NO se codifica implícitamente: viaja dentro del resultado.
LIMITE_POR_OMISION_MS = 50.0

# Con una sola fuente no hay forma de detectar que esa fuente miente. Dos es el
# mínimo que permite comprobar solapamiento; no es mucho, pero es infinitamente
# más que una.
QUORUM_MINIMO = 2

# Tras dos fallos seguidos contra el mismo servidor se deja de insistir. Con
# UDP/123 bloqueado, insistir 8 veces por servidor solo multiplica la espera de
# Jean por ocho para llegar al mismo UNKNOWN.
FALLOS_CONSECUTIVOS_MAXIMOS = 2

# Pausa entre muestras al mismo servidor. Ni castiga a un servidor público ni
# hace la sonda lenta.
PAUSA_ENTRE_MUESTRAS_S = 0.05

TAMANO_PAQUETE = 48

# Cabecera NTP (RFC 5905, figura 8): LI|VN|Mode, estrato, sondeo, precisión,
# demora de raíz, dispersión de raíz, id. de referencia, y cuatro marcas de
# 64 bits (referencia, origen, recepción, transmisión).
_FORMATO_PAQUETE = "!BBbb11I"

# LI = 0, VN = 3, Mode = 3 (cliente). Versión 3 en la petición porque todo
# servidor v4 responde a un cliente v3, y ningún v3 responde a un v4.
_PRIMER_BYTE_PETICION = 0x1B

_MODO_SERVIDOR = 4
_VERSIONES_ACEPTADAS = (3, 4)
_LEAP_ALARMA = 3
_ESTRATO_MAXIMO = 15

_NS_POR_MS = 1_000_000
_NS_POR_S = 1_000_000_000

CRITERIO = (
    "|offset estimado| + incertidumbre certificable <= límite declarado, con "
    "incertidumbre = distancia de raíz (root_delay/2 + root_dispersion) + "
    "delta/2 de la muestra elegida."
)

NO_DEMUESTRA = (
    "Un PASS de esta sonda significa «en el instante de la medición, el desvío "
    "más la banda que la propia medición demuestra caben dentro del límite». "
    "NUNCA significa «el reloj estuvo bien durante la captura»."
)

LIMITACIONES = (
    "Mide un instante, el de la sonda. Lo que el reloj hizo durante una captura "
    "se busca en los CSV con detector_saltos.py.",
    "Si UDP/123 está bloqueado no hay medición: el resultado es UNKNOWN por "
    "falta de cuórum, nunca un PASS por omisión.",
    "La resolución de nombres la hace el sistema operativo y no respeta el "
    "tiempo de espera de esta sonda.",
    "Se comprueba que las fuentes se solapen dentro de sus bandas, pero un error "
    "común a todas ellas es indetectable desde aquí.",
)


class ErrorSonda(ErrorEvidencia):
    """Una consulta no se pudo completar o la respuesta no es utilizable.

    Deriva de ``ErrorEvidencia`` porque mantiene la misma distinción que el
    resto de las herramientas: «no pude mirar» no es «miré y salió mal». Una
    muestra que no se pudo obtener retira evidencia; jamás añade un PASS.
    """


@dataclass(frozen=True, slots=True)
class Muestra:
    """Una consulta SNTP completa, con sus cuatro marcas y su cabecera.

    Se guardan los campos crudos y no solo el resultado para que cualquiera
    pueda rehacer la aritmética a mano. El gate vigente publica un número sin
    sus entradas y por eso nadie pudo comprobar de dónde salía el 17,478 ms.
    """

    servidor: str
    theta_ns: int  # offset estimado: ((T2-T1)+(T3-T4))/2
    delta_ns: int  # retardo de ida y vuelta: (T4-T1)-(T3-T2)
    stratum: int
    leap: int
    root_delay_ns: int
    root_dispersion_ns: int
    t1_ns: int
    t4_ns: int

    @property
    def distancia_raiz_ns(self) -> int:
        """Distancia de raíz declarada por el servidor: delay/2 + dispersion.

        RFC 5905, §11.2. Es la incertidumbre que el servidor **hereda** de su
        propia cadena hasta el reloj de referencia, y viaja dentro del paquete:
        no se supone, se lee. Es la magnitud que el informe de W32Time de campo
        también declaraba (0,1299577 s y 0,0801773 s) y que el gate ignoró.
        """

        return self.root_delay_ns // 2 + self.root_dispersion_ns

    @property
    def incertidumbre_ns(self) -> int:
        """Incertidumbre certificable de ESTA muestra.

        ``distancia_de_raíz + delta/2``. El segundo sumando acota la asimetría
        del camino: sin más información, el desvío verdadero puede estar en
        cualquier punto de ``theta ± delta/2`` (la misma cota que documenta
        ``rest.py:217-267``). Un ``delta`` negativo, posible por cuantización
        del reloj en trayectos muy cortos, se trata como cero: una asimetría
        negativa no existe.
        """

        return self.distancia_raiz_ns + max(self.delta_ns, 0) // 2


@dataclass(frozen=True, slots=True)
class Resultado:
    """Resultado completo de la sonda, con todo lo necesario para auditarlo.

    ``theta_ns`` e ``incertidumbre_ns`` son ``None`` cuando no hubo medición
    utilizable. Deliberadamente ``None`` y no cero: un cero se leería como «el
    reloj está perfecto», que es justo la mentira que este módulo evita.
    """

    muestras: list[Muestra]
    theta_ns: int | None
    incertidumbre_ns: int | None
    servidores_ok: list[str]
    servidores_fallidos: dict[str, str]
    veredicto: str  # PASS | FAIL | UNKNOWN
    motivo: str
    limite_ms: float


# --------------------------------------------------------------------------- #
# Aritmética del protocolo
# --------------------------------------------------------------------------- #


def _fijo_16_16_a_ns(valor: int) -> int:
    """Convierte un «NTP short format» (16 bits enteros, 16 de fracción) a ns.

    Es el formato de ``root_delay`` y ``root_dispersion`` (RFC 5905, §6).
    """

    return (valor * _NS_POR_S) // (1 << 16)


def _marca_ntp_a_ns(segundos: int, fraccion: int) -> int:
    """Convierte una marca NTP de 64 bits a nanosegundos desde la época Unix.

    RFC 4330, §3: si el bit más significativo del campo de segundos está
    puesto, la marca pertenece a la era 0 (1900-2036); si está a cero, a la
    era 1 (2036-2172). Tratar siempre la marca como era 0 haría que esta sonda
    empezase a mentir en 2036 sin avisar, y este proyecto no acepta código con
    fecha de caducidad silenciosa.
    """

    if segundos & 0x80000000:
        segundos_unix = segundos - EPOCA_NTP
    else:
        segundos_unix = segundos + (1 << 32) - EPOCA_NTP
    return segundos_unix * _NS_POR_S + (fraccion * _NS_POR_S) // (1 << 32)


def construir_peticion() -> bytes:
    """Construye la petición SNTP de cliente: 48 bytes, primer byte 0x1B.

    El campo de marca de transmisión (bytes 40..47) lleva 8 bytes aleatorios en
    vez de una hora. Es la práctica que usan los clientes serios: el servidor
    devuelve ese valor tal cual en el campo de origen, de modo que sirve de
    testigo para descartar una respuesta que no corresponde a esta petición.
    Nuestra ``T1`` se mide localmente justo antes de enviar, así que no se
    pierde nada por no poner ahí una hora de verdad, y se gana la comprobación.
    """

    paquete = bytearray(TAMANO_PAQUETE)
    paquete[0] = _PRIMER_BYTE_PETICION
    paquete[40:48] = os.urandom(8)
    return bytes(paquete)


def descifrar_respuesta(datos: bytes, t1_ns: int, t4_ns: int, servidor: str) -> Muestra:
    """Valida y traduce una respuesta SNTP a una ``Muestra``.

    Lanza ``ErrorSonda`` —nunca ``IndexError`` ni ``struct.error``— ante
    cualquier respuesta que no sea utilizable. Se rechaza, con motivo escrito:

    - Menos de 48 bytes: no es una cabecera NTP.
    - Versión distinta de 3 o 4, o modo distinto de 4 (servidor).
    - Indicador de salto 3 (alarma): el servidor **declara él mismo** que no
      está sincronizado. Una respuesta así es una opinión, no una medida.
    - Estrato 0 («kiss-o'-death», el servidor pide que dejes de preguntar) o
      mayor que 15 (no sincronizado).
    - Marcas de recepción o transmisión a cero: no hubo medida al otro lado.

    Fórmulas (RFC 5905, §8), idénticas a las que el motor ya usa contra Binance
    en ``rest.py:262``, salvo que aquí T2 y T3 son marcas reales y distintas::

        theta = ((T2 - T1) + (T3 - T4)) / 2
        delta = (T4 - T1) - (T3 - T2)
    """

    if len(datos) < TAMANO_PAQUETE:
        raise ErrorSonda(
            f"{servidor}: respuesta de {len(datos)} bytes, se necesitan "
            f"{TAMANO_PAQUETE} para una cabecera NTP"
        )

    try:
        campos = struct.unpack(_FORMATO_PAQUETE, bytes(datos[:TAMANO_PAQUETE]))
    except struct.error as exc:  # pragma: no cover - defensivo: el tamaño ya se validó
        raise ErrorSonda(f"{servidor}: cabecera NTP ilegible: {exc}") from exc

    (
        li_vn_modo,
        stratum,
        _sondeo,
        _precision,
        root_delay,
        root_dispersion,
        id_referencia,
        _ref_s,
        _ref_f,
        _org_s,
        _org_f,
        t2_s,
        t2_f,
        t3_s,
        t3_f,
    ) = campos

    leap = (li_vn_modo >> 6) & 0x03
    version = (li_vn_modo >> 3) & 0x07
    modo = li_vn_modo & 0x07

    if version not in _VERSIONES_ACEPTADAS:
        raise ErrorSonda(f"{servidor}: versión NTP {version}, no es 3 ni 4")
    if modo != _MODO_SERVIDOR:
        raise ErrorSonda(f"{servidor}: modo {modo}, se esperaba {_MODO_SERVIDOR} (servidor)")
    if leap == _LEAP_ALARMA:
        raise ErrorSonda(
            f"{servidor}: indicador de salto 3 (alarma); el propio servidor "
            "declara que NO está sincronizado, de modo que su hora no mide nada"
        )
    if stratum == 0:
        codigo = _texto_id_referencia(id_referencia)
        raise ErrorSonda(
            f"{servidor}: estrato 0 (kiss-o'-death «{codigo}»); el servidor "
            "rechaza la consulta y no entrega hora"
        )
    if stratum > _ESTRATO_MAXIMO:
        raise ErrorSonda(f"{servidor}: estrato {stratum}, por encima de {_ESTRATO_MAXIMO}")
    if (t2_s, t2_f) == (0, 0) or (t3_s, t3_f) == (0, 0):
        raise ErrorSonda(
            f"{servidor}: marca de recepción o de transmisión a cero; no hubo "
            "medida en el servidor"
        )

    t2_ns = _marca_ntp_a_ns(t2_s, t2_f)
    t3_ns = _marca_ntp_a_ns(t3_s, t3_f)

    theta_ns = ((t2_ns - t1_ns) + (t3_ns - t4_ns)) // 2
    delta_ns = (t4_ns - t1_ns) - (t3_ns - t2_ns)

    return Muestra(
        servidor=servidor,
        theta_ns=theta_ns,
        delta_ns=delta_ns,
        stratum=stratum,
        leap=leap,
        root_delay_ns=_fijo_16_16_a_ns(root_delay),
        root_dispersion_ns=_fijo_16_16_a_ns(root_dispersion),
        t1_ns=t1_ns,
        t4_ns=t4_ns,
    )


def _texto_id_referencia(valor: int) -> str:
    """El identificador de referencia como texto ASCII, para los códigos KoD."""

    crudo = valor.to_bytes(4, "big")
    legible = "".join(chr(b) if 32 <= b < 127 else "." for b in crudo)
    return legible


# --------------------------------------------------------------------------- #
# Transporte
# --------------------------------------------------------------------------- #


def _puerto_valido(texto: str, servidor: str) -> int:
    try:
        numero = int(texto)
    except ValueError as exc:
        raise ErrorSonda(f"puerto no numérico en «{servidor}»") from exc
    if not 1 <= numero <= 65535:
        raise ErrorSonda(f"puerto fuera de rango en «{servidor}»")
    return numero


def _separar_servidor(servidor: str, puerto_por_omision: int) -> tuple[str, int]:
    """Admite ``anfitrión``, ``anfitrión:puerto`` y ``[::1]:puerto``.

    El puerto explícito no es un capricho: permite probar esta sonda contra un
    servidor falso en bucle local sin pedir el puerto 123, que sí exige
    privilegios para escuchar. La regla de cero elevación también se aplica a
    las pruebas.
    """

    texto = servidor.strip()
    if not texto:
        raise ErrorSonda("nombre de servidor vacío")
    if texto.startswith("["):
        cierre = texto.find("]")
        if cierre < 0:
            raise ErrorSonda(f"literal IPv6 sin cerrar: «{servidor}»")
        anfitrion = texto[1:cierre]
        resto = texto[cierre + 1 :]
        if resto.startswith(":"):
            return anfitrion, _puerto_valido(resto[1:], servidor)
        if resto:
            raise ErrorSonda(f"sobra texto tras el literal IPv6: «{servidor}»")
        return anfitrion, puerto_por_omision
    if texto.count(":") == 1:
        anfitrion, _, crudo = texto.partition(":")
        if not anfitrion:
            raise ErrorSonda(f"falta el anfitrión en «{servidor}»")
        return anfitrion, _puerto_valido(crudo, servidor)
    # Dos o más «:» sin corchetes: es un literal IPv6 sin puerto.
    return texto, puerto_por_omision


def consultar(servidor: str, *, timeout_s: float = 2.0, puerto: int = PUERTO_NTP) -> Muestra:
    """Hace UNA consulta SNTP y devuelve su ``Muestra``.

    El socket se abre con puerto de origen efímero, que no exige privilegio
    alguno (regla 2 del proyecto: cero elevación), se conecta —así el sistema
    descarta por sí solo cualquier paquete de otro origen— y se cierra siempre.

    Cualquier fallo sale como ``ErrorSonda`` con su motivo en español. No se
    devuelve nunca una muestra a medias.
    """

    anfitrion, puerto_efectivo = _separar_servidor(servidor, puerto)
    try:
        candidatos = socket.getaddrinfo(
            anfitrion, puerto_efectivo, proto=socket.IPPROTO_UDP, type=socket.SOCK_DGRAM
        )
    except OSError as exc:
        raise ErrorSonda(f"{servidor}: no se pudo resolver el nombre ({exc})") from exc
    if not candidatos:
        raise ErrorSonda(f"{servidor}: la resolución de nombre no devolvió ninguna dirección")

    familia, tipo, protocolo, _canonico, direccion = candidatos[0]
    peticion = construir_peticion()
    testigo = peticion[40:48]

    sock = socket.socket(familia, tipo, protocolo)
    try:
        sock.settimeout(timeout_s)
        sock.connect(direccion)
        limite = time.monotonic() + max(timeout_s, 0.0)
        t1_ns = time.time_ns()
        sock.send(peticion)
        while True:
            restante = limite - time.monotonic()
            if restante <= 0:
                raise ErrorSonda(
                    f"{servidor}: sin respuesta válida en {timeout_s:g} s "
                    "(¿UDP/123 bloqueado por el cortafuegos o la red?)"
                )
            sock.settimeout(restante)
            datos = sock.recv(1024)
            t4_ns = time.time_ns()
            if len(datos) >= TAMANO_PAQUETE and bytes(datos[24:32]) != testigo:
                # No es la respuesta a ESTA petición: puede ser un paquete
                # retrasado o inyectado. Se descarta y se sigue esperando.
                continue
            return descifrar_respuesta(datos, t1_ns, t4_ns, servidor)
    except socket.timeout as exc:
        raise ErrorSonda(
            f"{servidor}: sin respuesta en {timeout_s:g} s "
            "(¿UDP/123 bloqueado por el cortafuegos o la red?)"
        ) from exc
    except ErrorSonda:
        raise
    except OSError as exc:
        raise ErrorSonda(f"{servidor}: error de red ({exc})") from exc
    finally:
        sock.close()


# --------------------------------------------------------------------------- #
# Selección y veredicto
# --------------------------------------------------------------------------- #


def mejores_por_servidor(muestras: Iterable[Muestra]) -> dict[str, Muestra]:
    """Filtrado clásico de NTP: por cada servidor, la muestra de MENOR delta.

    Por qué la de menor delta y no la mediana ni el promedio: la cota de error
    de una muestra es ``delta/2``, de modo que la muestra más rápida es
    literalmente la más informativa. Promediar mezclaría muestras con cotas
    distintas y produciría un número cuya banda ya no se sabría declarar, que es
    exactamente el defecto que esta herramienta viene a corregir.

    Los empates se rompen por ``t1_ns`` (la más antigua gana) para que dos
    ejecuciones sobre las mismas muestras den el mismo resultado.
    """

    mejores: dict[str, Muestra] = {}
    for muestra in muestras:
        actual = mejores.get(muestra.servidor)
        if actual is None or (muestra.delta_ns, muestra.t1_ns) < (actual.delta_ns, actual.t1_ns):
            mejores[muestra.servidor] = muestra
    return mejores


def _discrepancias(mejores: Sequence[Muestra]) -> list[str]:
    """Pares de servidores cuyas bandas NO se solapan.

    Si ``|theta_a - theta_b| > u_a + u_b``, los dos intervalos son disjuntos y
    por tanto **al menos uno de los dos servidores miente**. No se puede saber
    cuál, y ahí está la clave: quedarse con el que más gusta sería elegir el
    resultado. Se declara UNKNOWN.
    """

    problemas: list[str] = []
    for indice, primera in enumerate(mejores):
        for segunda in mejores[indice + 1 :]:
            banda = primera.incertidumbre_ns + segunda.incertidumbre_ns
            diferencia = abs(primera.theta_ns - segunda.theta_ns)
            if diferencia > banda:
                problemas.append(
                    f"{primera.servidor} dice {_ms(primera.theta_ns)} ms "
                    f"±{_ms(primera.incertidumbre_ns)} ms y "
                    f"{segunda.servidor} dice {_ms(segunda.theta_ns)} ms "
                    f"±{_ms(segunda.incertidumbre_ns)} ms: difieren "
                    f"{_ms(diferencia)} ms, más que la suma de sus bandas "
                    f"({_ms(banda)} ms)"
                )
    return problemas


def medir(
    servidores: Sequence[str] = SERVIDORES_POR_DEFECTO,
    *,
    muestras_por_servidor: int = 8,
    limite_ms: float = LIMITE_POR_OMISION_MS,
    timeout_s: float = 2.0,
    puerto: int = PUERTO_NTP,
) -> Resultado:
    """Consulta todos los servidores, combina y emite el veredicto.

    Nunca lanza por causas de red: un servidor caído, un nombre que no resuelve
    o UDP/123 bloqueado se convierten en una entrada de ``servidores_fallidos``
    con su motivo. Lo único que puede lanzar es ``ValueError`` por argumentos
    imposibles, que es un error de quien llama, no una medición.

    Orden exacto de las decisiones, y ninguna se puede saltar:

    1. **Cuórum**: menos de ``QUORUM_MINIMO`` servidores distintos que responden
       => UNKNOWN. Los nombres repetidos se colapsan: la misma fuente escrita
       dos veces no son dos opiniones independientes.
    2. **Coherencia**: si dos servidores no se solapan dentro de sus bandas,
       alguno miente => UNKNOWN. Nunca PASS.
    3. **Criterio**: ``|theta| + incertidumbre <= límite`` => PASS; si no, FAIL.

    La banda publicada nunca es menor que la dispersión realmente observada
    entre fuentes independientes: si dos servidores se solapan pero difieren,
    esa diferencia entra en la incertidumbre. Publicar una banda más estrecha
    que la discrepancia que uno mismo acaba de medir sería inventar precisión.
    """

    if isinstance(servidores, str):  # error frecuente: pasar un solo nombre suelto
        servidores = (servidores,)
    if muestras_por_servidor < 1:
        raise ValueError("muestras_por_servidor debe ser 1 o más")
    if not (limite_ms > 0):
        raise ValueError("limite_ms debe ser mayor que cero")

    # Nombres repetidos colapsados conservando el orden dado.
    lista = [nombre for nombre in dict.fromkeys(str(s).strip() for s in servidores) if nombre]

    todas: list[Muestra] = []
    servidores_ok: list[str] = []
    servidores_fallidos: dict[str, str] = {}

    for servidor in lista:
        obtenidas: list[Muestra] = []
        fallos = Hallazgos()
        consecutivos = 0
        for indice in range(muestras_por_servidor):
            if indice:
                time.sleep(PAUSA_ENTRE_MUESTRAS_S)
            try:
                muestra = consultar(servidor, timeout_s=timeout_s, puerto=puerto)
            except (ErrorEvidencia, OSError) as exc:
                fallos.anotar(_sin_prefijo(servidor, str(exc)))
                consecutivos += 1
                if consecutivos >= FALLOS_CONSECUTIVOS_MAXIMOS:
                    break
                continue
            except Exception as exc:  # pragma: no cover - defensivo
                # Nada inesperado puede convertirse en un rastro de excepción en
                # la cara de Jean. Retirar una muestra jamás fabrica un PASS.
                fallos.anotar(f"error inesperado ({type(exc).__name__}: {exc})")
                consecutivos += 1
                if consecutivos >= FALLOS_CONSECUTIVOS_MAXIMOS:
                    break
                continue
            consecutivos = 0
            obtenidas.append(muestra)

        if obtenidas:
            servidores_ok.append(servidor)
            todas.extend(obtenidas)
        else:
            servidores_fallidos[servidor] = fallos.texto() or "sin respuesta y sin motivo registrado"

    return _componer(
        muestras=todas,
        servidores_ok=servidores_ok,
        servidores_fallidos=servidores_fallidos,
        limite_ms=limite_ms,
        pedidos=len(lista),
    )


def _sin_prefijo(servidor: str, mensaje: str) -> str:
    """Quita el nombre del servidor del principio del motivo.

    ``consultar`` antepone el nombre porque su excepción puede viajar sola;
    ``servidores_fallidos`` ya está indexado por servidor, y repetirlo dos veces
    en la misma línea solo estorba a quien lee el informe.
    """

    marca = f"{servidor}: "
    return mensaje[len(marca) :] if mensaje.startswith(marca) else mensaje


def _componer(
    *,
    muestras: list[Muestra],
    servidores_ok: list[str],
    servidores_fallidos: dict[str, str],
    limite_ms: float,
    pedidos: int,
) -> Resultado:
    """Aplica cuórum, coherencia y criterio. Separado de la red para poder probarlo."""

    def sin_medida(motivo: str) -> Resultado:
        return Resultado(
            muestras=muestras,
            theta_ns=None,
            incertidumbre_ns=None,
            servidores_ok=servidores_ok,
            servidores_fallidos=servidores_fallidos,
            veredicto=DESCONOCIDO,
            motivo=motivo,
            limite_ms=limite_ms,
        )

    detalle_fallos = "; ".join(f"{nombre}: {motivo}" for nombre, motivo in servidores_fallidos.items())

    mejores = mejores_por_servidor(muestras)
    if len(mejores) < QUORUM_MINIMO:
        cuerpo = (
            f"cuórum insuficiente: respondieron {len(mejores)} de {pedidos} "
            f"servidores distintos y se exigen {QUORUM_MINIMO}"
        )
        if detalle_fallos:
            cuerpo += f". Fallos: {detalle_fallos}"
        cuerpo += (
            ". Sin cuórum no se puede detectar una fuente que mienta, de modo "
            "que no se emite ningún número como si estuviera demostrado."
        )
        return sin_medida(cuerpo)

    elegidas = sorted(mejores.values(), key=lambda m: m.servidor)
    problemas = _discrepancias(elegidas)
    if problemas:
        return sin_medida(
            "servidores incoherentes entre sí, al menos uno miente: "
            + "; ".join(problemas)
            + ". Elegir uno sería elegir el resultado, así que no se elige."
        )

    elegida = min(elegidas, key=lambda m: (m.incertidumbre_ns, m.delta_ns, m.servidor))
    dispersion_ns = max(abs(m.theta_ns - elegida.theta_ns) for m in elegidas)
    incertidumbre_ns = max(elegida.incertidumbre_ns, dispersion_ns)
    theta_ns = elegida.theta_ns
    limite_ns = int(round(limite_ms * _NS_POR_MS))
    total_ns = abs(theta_ns) + incertidumbre_ns

    base = (
        f"{len(elegidas)} servidores con cuórum; fuente elegida {elegida.servidor} "
        f"(estrato {elegida.stratum}, delta {_ms(elegida.delta_ns)} ms, "
        f"distancia de raíz {_ms(elegida.distancia_raiz_ns)} ms). "
        f"|{_ms(theta_ns)}| + {_ms(incertidumbre_ns)} = {_ms(total_ns)} ms "
        f"frente a un límite de {_ms(limite_ns)} ms"
    )
    if detalle_fallos:
        base += f". No respondieron: {detalle_fallos}"

    if total_ns <= limite_ns:
        veredicto = PASS
        motivo = base + ". " + NO_DEMUESTRA
    else:
        veredicto = FAIL
        motivo = (
            base
            + ". El desvío por sí solo "
            + ("SÍ" if abs(theta_ns) <= limite_ns else "tampoco")
            + " cabría en el límite; lo que no cabe es el desvío MÁS la banda que "
            "esta misma medición demuestra, y esa suma es el criterio."
        )

    return Resultado(
        muestras=muestras,
        theta_ns=theta_ns,
        incertidumbre_ns=incertidumbre_ns,
        servidores_ok=servidores_ok,
        servidores_fallidos=servidores_fallidos,
        veredicto=veredicto,
        motivo=motivo,
        limite_ms=limite_ms,
    )


# --------------------------------------------------------------------------- #
# Informes
# --------------------------------------------------------------------------- #


def _ms(valor_ns: float) -> str:
    """Nanosegundos a milisegundos con coma decimal, como el resto del proyecto."""

    return f"{valor_ns / _NS_POR_MS:.3f}".replace(".", ",")


def _ms_num(valor_ns: int | None) -> float | None:
    """Nanosegundos a milisegundos como número, para el JSON. ``None`` sigue siendo ``None``."""

    if valor_ns is None:
        return None
    return round(valor_ns / _NS_POR_MS, 6)


def informe_texto(resultado: Resultado) -> str:
    """Informe legible para Jean, que no es programador.

    Enseña siempre la aritmética completa del criterio, porque el defecto que
    esta herramienta corrige fue precisamente publicar un número sin su banda.
    """

    lineas: list[str] = []
    lineas.append("SONDA DE RELOJ SNTP — JEAN_FLOW 555 META_QUANT")
    lineas.append("=" * 72)
    lineas.append("")
    lineas.append(f"VEREDICTO: {resultado.veredicto}")
    lineas.append(f"MOTIVO   : {resultado.motivo}")
    lineas.append("")
    lineas.append("CRITERIO APLICADO")
    lineas.append(f"  {CRITERIO}")
    lineas.append(f"  Límite declarado: {resultado.limite_ms:.3f} ms".replace(".", ","))
    if resultado.theta_ns is None or resultado.incertidumbre_ns is None:
        lineas.append("  Desvío estimado : (no medido)")
        lineas.append("  Incertidumbre   : (no medida)")
        lineas.append("  Suma            : (no calculable)")
    else:
        total = abs(resultado.theta_ns) + resultado.incertidumbre_ns
        lineas.append(f"  Desvío estimado : {_ms(resultado.theta_ns)} ms")
        lineas.append(f"  Incertidumbre   : {_ms(resultado.incertidumbre_ns)} ms")
        lineas.append(
            f"  Suma            : {_ms(total)} ms "
            f"({'cabe' if total <= resultado.limite_ms * _NS_POR_MS else 'NO cabe'} "
            "en el límite)"
        )
    lineas.append("")

    lineas.append("SERVIDORES QUE RESPONDIERON")
    lineas.append("-" * 72)
    mejores = mejores_por_servidor(resultado.muestras)
    if not mejores:
        lineas.append("  ninguno")
    for nombre in sorted(mejores):
        muestra = mejores[nombre]
        cuantas = sum(1 for m in resultado.muestras if m.servidor == nombre)
        lineas.append(f"  {nombre}")
        lineas.append(f"      muestras válidas    : {cuantas}")
        lineas.append(f"      mejor delta (RTT)   : {_ms(muestra.delta_ns)} ms")
        lineas.append(f"      desvío de esa muestra: {_ms(muestra.theta_ns)} ms")
        lineas.append(f"      estrato             : {muestra.stratum}")
        lineas.append(f"      indicador de salto  : {muestra.leap}")
        lineas.append(f"      demora de raíz      : {_ms(muestra.root_delay_ns)} ms")
        lineas.append(f"      dispersión de raíz  : {_ms(muestra.root_dispersion_ns)} ms")
        lineas.append(f"      distancia de raíz   : {_ms(muestra.distancia_raiz_ns)} ms")
        lineas.append(f"      incertidumbre       : {_ms(muestra.incertidumbre_ns)} ms")
    lineas.append("")

    if resultado.servidores_fallidos:
        lineas.append("SERVIDORES QUE NO SIRVIERON")
        lineas.append("-" * 72)
        for nombre, motivo in resultado.servidores_fallidos.items():
            lineas.append(f"  {nombre}: {motivo}")
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
        "Esta sonda no toca el reloj del sistema, no necesita permisos de "
        "administrador y no modifica ningún archivo de runs/."
    )
    return "\n".join(lineas)


def informe_json(resultado: Resultado) -> dict[str, Any]:
    """Artefacto JSON de la sonda, listo para ``escribir_json_atomico``.

    Cuando no hubo medición, ``theta_ms`` e ``incertidumbre_ms`` salen como
    ``null``, nunca como cero: un cero se leería como un reloj perfecto.
    """

    mejores = mejores_por_servidor(resultado.muestras)
    total_ns = (
        abs(resultado.theta_ns) + resultado.incertidumbre_ns
        if resultado.theta_ns is not None and resultado.incertidumbre_ns is not None
        else None
    )
    return {
        "herramienta": "sonda_reloj",
        "version": VERSION_SONDA,
        "generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "veredicto": resultado.veredicto,
        "motivo": resultado.motivo,
        "criterio": CRITERIO,
        "limite_ms": resultado.limite_ms,
        "theta_ms": _ms_num(resultado.theta_ns),
        "incertidumbre_ms": _ms_num(resultado.incertidumbre_ns),
        "suma_ms": _ms_num(total_ns),
        "quorum_minimo": QUORUM_MINIMO,
        "servidores_ok": list(resultado.servidores_ok),
        "servidores_fallidos": dict(resultado.servidores_fallidos),
        "muestras_totales": len(resultado.muestras),
        "elegidas_por_servidor": [
            _muestra_a_dict(mejores[nombre], elegida=True) for nombre in sorted(mejores)
        ],
        "no_demuestra": NO_DEMUESTRA,
        "limitaciones": list(LIMITACIONES),
    }


def _muestra_a_dict(muestra: Muestra, *, elegida: bool) -> dict[str, Any]:
    """Una muestra en forma de diccionario, con los crudos y los derivados."""

    return {
        "servidor": muestra.servidor,
        "elegida": elegida,
        "theta_ns": muestra.theta_ns,
        "theta_ms": _ms_num(muestra.theta_ns),
        "delta_ns": muestra.delta_ns,
        "delta_ms": _ms_num(muestra.delta_ns),
        "stratum": muestra.stratum,
        "leap": muestra.leap,
        "root_delay_ns": muestra.root_delay_ns,
        "root_dispersion_ns": muestra.root_dispersion_ns,
        "distancia_raiz_ns": muestra.distancia_raiz_ns,
        "incertidumbre_ns": muestra.incertidumbre_ns,
        "incertidumbre_ms": _ms_num(muestra.incertidumbre_ns),
        "t1_ns": muestra.t1_ns,
        "t4_ns": muestra.t4_ns,
    }


def _ruta_de_salida_permitida(destino: Path) -> None:
    """Impide escribir dentro de ``runs/``. Regla 1: la evidencia es intocable."""

    partes = {parte.lower() for parte in destino.resolve().parts}
    if "runs" in partes:
        raise ValueError(
            "la salida no puede escribirse dentro de runs/: esa carpeta es "
            "evidencia de solo lectura. Elija un destino fuera del árbol de "
            "corridas."
        )


def escribir_informe(resultado: Resultado, destino: Path) -> None:
    """Escribe el informe JSON de forma atómica con el helper compartido."""

    ruta = Path(destino)
    _ruta_de_salida_permitida(ruta)
    escribir_json_atomico(ruta, informe_json(resultado))


def escribir_muestras_jsonl(resultado: Resultado, destino: Path) -> None:
    """Escribe TODAS las muestras crudas, una por línea, de forma atómica.

    Se emiten todas y no solo las elegidas para que cualquiera pueda rehacer la
    selección y comprobar que no se descartó lo que estorbaba. Cada línea lleva
    ``elegida`` para saber cuál entró en el veredicto.

    JSONL no es un objeto JSON, de modo que no puede pasar por
    ``escribir_json_atomico``; se usa aquí su mismo mecanismo exacto —temporal
    en el directorio de destino, ``flush``, ``fsync`` y ``os.replace``—, de modo
    que nunca exista un archivo a medias.
    """

    ruta = Path(destino)
    _ruta_de_salida_permitida(ruta)
    mejores = mejores_por_servidor(resultado.muestras)
    lineas = [
        json.dumps(
            _muestra_a_dict(muestra, elegida=mejores.get(muestra.servidor) is muestra),
            sort_keys=True,
            ensure_ascii=False,
        )
        for muestra in resultado.muestras
    ]

    ruta.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporal = tempfile.mkstemp(dir=str(ruta.parent), prefix=f".{ruta.name}.", suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as fh:
            for linea in lineas:
                fh.write(linea)
                fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(temporal, ruta)
    except BaseException:
        try:
            os.unlink(temporal)
        except OSError:
            pass
        raise


# --------------------------------------------------------------------------- #
# Línea de órdenes
# --------------------------------------------------------------------------- #


def _main(argumentos: Iterable[str] | None = None) -> int:
    """Punto de entrada de línea de órdenes. No toca el reloj ni la evidencia."""

    analizador = argparse.ArgumentParser(
        prog="sonda_reloj",
        description=(
            "Mide el desvío del reloj con muchas muestras SNTP y publica la "
            "banda que la medición demuestra. No ajusta el reloj y no necesita "
            "permisos de administrador."
        ),
    )
    analizador.add_argument(
        "--servidor",
        action="append",
        default=None,
        help="servidor NTP (admite anfitrión:puerto). Repetible.",
    )
    analizador.add_argument("--muestras", type=int, default=8, help="muestras por servidor")
    analizador.add_argument(
        "--limite-ms", type=float, default=LIMITE_POR_OMISION_MS, dest="limite_ms"
    )
    analizador.add_argument("--timeout-s", type=float, default=2.0, dest="timeout_s")
    analizador.add_argument("--json", action="store_true", help="salida en JSON")
    analizador.add_argument("--salida", type=Path, default=None, help="informe JSON de salida")
    analizador.add_argument(
        "--muestras-jsonl", type=Path, default=None, dest="muestras_jsonl"
    )
    args = analizador.parse_args(list(argumentos) if argumentos is not None else None)

    servidores = tuple(args.servidor) if args.servidor else SERVIDORES_POR_DEFECTO
    resultado = medir(
        servidores,
        muestras_por_servidor=args.muestras,
        limite_ms=args.limite_ms,
        timeout_s=args.timeout_s,
    )

    if args.json:
        print(json.dumps(informe_json(resultado), indent=2, sort_keys=True, ensure_ascii=False))
    else:
        print(informe_texto(resultado))

    if args.salida is not None:
        escribir_informe(resultado, args.salida)
        print(f"\nInforme escrito en: {args.salida}")
    if args.muestras_jsonl is not None:
        escribir_muestras_jsonl(resultado, args.muestras_jsonl)
        print(f"Muestras crudas en: {args.muestras_jsonl}")

    return {PASS: 0, DESCONOCIDO: 1, FAIL: 3}.get(resultado.veredicto, 1)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(_main(sys.argv[1:]))
