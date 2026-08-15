"""Pruebas de la sonda de reloj SNTP.

Se ejecutan con la biblioteca estándar, sin instalar nada:

    cd herramientas && python3 -m unittest discover -s tests -v

NINGUNA prueba toca la red real. Todas hablan con un servidor NTP falso que
vive en 127.0.0.1, en un puerto efímero y en un hilo de este mismo proceso, y
que se apaga en el ``addCleanup`` de cada prueba. Esto no es una comodidad: en
el entorno de pruebas de este proyecto UDP/123 está **bloqueado**, de modo que
una prueba que dependiera de la red no probaría nada, solo mediría el
cortafuegos.

El servidor falso permite fijar a voluntad el desvío, el estrato, el indicador
de salto, la demora de raíz y la dispersión de raíz, que es exactamente lo que
hace falta para comprobar el criterio central:

    |offset| + incertidumbre certificable <= límite

y no el criterio del gate vigente, que es |offset| <= límite y por eso aprobó
en campo con 17,478 ms mientras su propia cadena declaraba unos ±145 ms.
"""

from __future__ import annotations

import json
import socket
import struct
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

# Permite ejecutar las pruebas también desde fuera de la carpeta herramientas.
_RAIZ = Path(__file__).resolve().parent.parent
if str(_RAIZ) not in sys.path:
    sys.path.insert(0, str(_RAIZ))

from jf_evidencia.comun import DESCONOCIDO, ESTADOS_VALIDOS, FAIL, PASS, ErrorEvidencia
from jf_evidencia.sonda_reloj import (
    EPOCA_NTP,
    LIMITE_POR_OMISION_MS,
    PUERTO_NTP,
    QUORUM_MINIMO,
    SERVIDORES_POR_DEFECTO,
    TAMANO_PAQUETE,
    ErrorSonda,
    Muestra,
    consultar,
    construir_peticion,
    descifrar_respuesta,
    escribir_muestras_jsonl,
    informe_json,
    informe_texto,
    medir,
    mejores_por_servidor,
)

_NS_POR_MS = 1_000_000
_NS_POR_S = 1_000_000_000


# --------------------------------------------------------------------------- #
# Servidor NTP falso
# --------------------------------------------------------------------------- #


def _ns_a_marca_ntp(valor_ns: int) -> tuple[int, int]:
    """Nanosegundos Unix a marca NTP de 64 bits (segundos desde 1900 + fracción)."""

    segundos = valor_ns // _NS_POR_S + EPOCA_NTP
    fraccion = ((valor_ns % _NS_POR_S) * (1 << 32)) // _NS_POR_S
    return segundos & 0xFFFFFFFF, fraccion & 0xFFFFFFFF


def _ns_a_fijo_16_16(valor_ns: int) -> int:
    """Nanosegundos a «NTP short format» (16 bits enteros, 16 de fracción)."""

    return (valor_ns * (1 << 16)) // _NS_POR_S


def construir_paquete_ntp(
    *,
    leap: int = 0,
    version: int = 4,
    modo: int = 4,
    stratum: int = 2,
    root_delay_ns: int = 0,
    root_dispersion_ns: int = 0,
    origen: bytes = b"\x00" * 8,
    t2_ns: int | None = None,
    t3_ns: int | None = None,
) -> bytes:
    """Construye una respuesta NTP de 48 bytes con la cabecera que se le pida.

    Se usa tanto en el servidor falso como en las pruebas que atacan
    directamente a ``descifrar_respuesta``, para no tener dos generadores de
    paquetes que puedan discrepar entre sí.
    """

    ahora = time.time_ns()
    t2 = ahora if t2_ns is None else t2_ns
    t3 = ahora if t3_ns is None else t3_ns

    primer_byte = ((leap & 0x3) << 6) | ((version & 0x7) << 3) | (modo & 0x7)
    cabecera = struct.pack("!BBbb", primer_byte, stratum & 0xFF, 4, -20)
    cabecera += struct.pack(
        "!III",
        _ns_a_fijo_16_16(root_delay_ns) & 0xFFFFFFFF,
        _ns_a_fijo_16_16(root_dispersion_ns) & 0xFFFFFFFF,
        0x4C4F434C,  # «LOCL»
    )
    cabecera += struct.pack("!II", *_ns_a_marca_ntp(ahora))  # referencia
    cabecera += origen[:8].ljust(8, b"\x00")  # origen: eco del testigo del cliente
    cabecera += struct.pack("!II", *_ns_a_marca_ntp(t2))
    cabecera += struct.pack("!II", *_ns_a_marca_ntp(t3))
    assert len(cabecera) == TAMANO_PAQUETE
    return cabecera


class ServidorNtpFalso:
    """Servidor SNTP mínimo en 127.0.0.1, en un hilo, con desvío a la carta.

    Escucha en un puerto efímero: la regla de cero elevación del proyecto
    también vale para las pruebas, y escuchar en el 123 exigiría privilegios.
    """

    def __init__(
        self,
        *,
        desvio_ns: int = 0,
        leap: int = 0,
        version: int = 4,
        modo: int = 4,
        stratum: int = 2,
        root_delay_ns: int = 0,
        root_dispersion_ns: int = 0,
        mudo: bool = False,
        eco: bool = True,
    ) -> None:
        self.desvio_ns = desvio_ns
        self.leap = leap
        self.version = version
        self.modo = modo
        self.stratum = stratum
        self.root_delay_ns = root_delay_ns
        self.root_dispersion_ns = root_dispersion_ns
        self.mudo = mudo
        self.eco = eco
        self.peticiones = 0

        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.bind(("127.0.0.1", 0))
        self._sock.settimeout(0.05)
        self.puerto = self._sock.getsockname()[1]
        self._parar = threading.Event()
        self._hilo = threading.Thread(target=self._servir, name="ntp-falso", daemon=True)

    @property
    def direccion(self) -> str:
        """Nombre que se le pasa a la sonda: ``127.0.0.1:<puerto efímero>``."""

        return f"127.0.0.1:{self.puerto}"

    def iniciar(self) -> None:
        self._hilo.start()

    def detener(self) -> None:
        self._parar.set()
        if self._hilo.is_alive():
            self._hilo.join(timeout=2.0)
        self._sock.close()

    def _servir(self) -> None:
        while not self._parar.is_set():
            try:
                datos, remitente = self._sock.recvfrom(1024)
            except socket.timeout:
                continue
            except OSError:  # el socket se cerró mientras esperábamos
                return
            self.peticiones += 1
            if self.mudo:
                continue
            origen = datos[40:48] if (self.eco and len(datos) >= TAMANO_PAQUETE) else b"\x00" * 8
            ahora = time.time_ns()
            respuesta = construir_paquete_ntp(
                leap=self.leap,
                version=self.version,
                modo=self.modo,
                stratum=self.stratum,
                root_delay_ns=self.root_delay_ns,
                root_dispersion_ns=self.root_dispersion_ns,
                origen=origen,
                t2_ns=ahora + self.desvio_ns,
                t3_ns=time.time_ns() + self.desvio_ns,
            )
            try:
                self._sock.sendto(respuesta, remitente)
            except OSError:  # pragma: no cover - defensivo
                return


class BaseSonda(unittest.TestCase):
    """Base con la fábrica de servidores falsos y su apagado garantizado."""

    def arrancar_servidor(self, **opciones: object) -> ServidorNtpFalso:
        servidor = ServidorNtpFalso(**opciones)  # type: ignore[arg-type]
        self.addCleanup(servidor.detener)
        servidor.iniciar()
        return servidor


# --------------------------------------------------------------------------- #
# Protocolo
# --------------------------------------------------------------------------- #


class PruebasProtocolo(BaseSonda):
    def test_peticion_48_bytes_primer_byte_0x1b(self) -> None:
        """LI=0, VN=3, Mode=3 (cliente) es exactamente 0x1B, y la cabecera 48 bytes."""

        peticion = construir_peticion()
        self.assertEqual(len(peticion), 48)
        self.assertEqual(peticion[0], 0x1B)
        self.assertEqual(TAMANO_PAQUETE, 48)

    def test_peticion_lleva_testigo_aleatorio(self) -> None:
        """El campo de transmisión es un testigo: dos peticiones no coinciden.

        Sin testigo no se puede distinguir la respuesta a esta petición de un
        paquete retrasado o inyectado.
        """

        testigos = {construir_peticion()[40:48] for _ in range(8)}
        self.assertGreater(len(testigos), 1)

    def test_respuesta_corta_lanza_error_tipado(self) -> None:
        """Menos de 48 bytes es ErrorSonda con motivo, jamás un IndexError crudo."""

        for datos in (b"", b"\x1c", b"\x00" * 47):
            with self.subTest(longitud=len(datos)):
                with self.assertRaises(ErrorSonda) as caja:
                    descifrar_respuesta(datos, 1, 2, "falso")
                self.assertIsInstance(caja.exception, ErrorEvidencia)
                self.assertNotIsInstance(caja.exception, IndexError)
                self.assertNotIsInstance(caja.exception, struct.error)
                self.assertIn("48", str(caja.exception))

    def test_leap_de_alarma_se_descarta(self) -> None:
        """Indicador de salto 3: el servidor declara que NO está sincronizado."""

        paquete = construir_paquete_ntp(leap=3)
        with self.assertRaises(ErrorSonda) as caja:
            descifrar_respuesta(paquete, time.time_ns(), time.time_ns(), "falso")
        self.assertIn("salto", str(caja.exception).lower())

    def test_estrato_cero_y_estrato_alto_se_descartan(self) -> None:
        """Estrato 0 es kiss-o'-death; por encima de 15 es «no sincronizado»."""

        for stratum in (0, 16, 200):
            with self.subTest(stratum=stratum):
                paquete = construir_paquete_ntp(stratum=stratum)
                with self.assertRaises(ErrorSonda):
                    descifrar_respuesta(paquete, time.time_ns(), time.time_ns(), "falso")

    def test_modo_incorrecto_se_descarta(self) -> None:
        paquete = construir_paquete_ntp(modo=3)
        with self.assertRaises(ErrorSonda):
            descifrar_respuesta(paquete, time.time_ns(), time.time_ns(), "falso")

    def test_marcas_a_cero_se_descartan(self) -> None:
        """Un paquete sin marcas de servidor no contiene ninguna medida."""

        paquete = bytearray(construir_paquete_ntp())
        paquete[32:48] = b"\x00" * 16
        with self.assertRaises(ErrorSonda):
            descifrar_respuesta(bytes(paquete), time.time_ns(), time.time_ns(), "falso")

    def test_distancia_de_raiz_es_delay_medio_mas_dispersion(self) -> None:
        """La fórmula, con los números reales del preflight de campo.

        `clock_preflight.json` de la corrida 20260814T081121_393783Z declara
        demora de raíz 0,1299577 s y dispersión de raíz 0,0801773 s: la
        distancia de raíz es 0,14516 s, esos ±145 ms que el gate ignoró.
        """

        muestra = Muestra(
            servidor="w32time-de-campo",
            theta_ns=17_478_000,
            delta_ns=0,
            stratum=2,
            leap=0,
            root_delay_ns=129_957_700,
            root_dispersion_ns=80_177_300,
            t1_ns=0,
            t4_ns=0,
        )
        self.assertEqual(muestra.distancia_raiz_ns, 129_957_700 // 2 + 80_177_300)
        self.assertAlmostEqual(muestra.distancia_raiz_ns / _NS_POR_MS, 145.156, places=2)
        # Y el criterio correcto habría rechazado aquel PASS de campo.
        total_ms = (abs(muestra.theta_ns) + muestra.incertidumbre_ns) / _NS_POR_MS
        self.assertGreater(total_ms, 50.0)


# --------------------------------------------------------------------------- #
# Medición contra el servidor falso
# --------------------------------------------------------------------------- #


class PruebasMedicion(BaseSonda):
    def test_desvio_conocido_de_373_ms(self) -> None:
        """Un desvío inyectado de +373 ms se recupera con menos de 5 ms de error."""

        desvio_ns = 373 * _NS_POR_MS
        servidor = self.arrancar_servidor(desvio_ns=desvio_ns)
        muestra = consultar(servidor.direccion, timeout_s=1.0)
        error_ms = abs(muestra.theta_ns - desvio_ns) / _NS_POR_MS
        self.assertLess(error_ms, 5.0, f"theta recuperado con {error_ms} ms de error")
        self.assertEqual(muestra.servidor, servidor.direccion)
        self.assertEqual(muestra.stratum, 2)
        self.assertEqual(muestra.leap, 0)

    def test_la_cota_delta_medio_se_respeta(self) -> None:
        """|theta_real - theta_estimado| <= delta/2 en la muestra elegida.

        Es la cota que el propio motor documenta en ``rest.py:217-267``. Si no
        se cumpliera, la incertidumbre publicada por esta sonda sería falsa.
        """

        desvio_ns = 373 * _NS_POR_MS
        servidor = self.arrancar_servidor(desvio_ns=desvio_ns)
        muestras = [consultar(servidor.direccion, timeout_s=1.0) for _ in range(5)]
        elegida = mejores_por_servidor(muestras)[servidor.direccion]
        self.assertGreaterEqual(elegida.delta_ns, 0)
        self.assertLessEqual(abs(desvio_ns - elegida.theta_ns), elegida.delta_ns // 2 + 1)
        # Y la elegida es de verdad la de menor delta.
        self.assertEqual(elegida.delta_ns, min(m.delta_ns for m in muestras))

    def test_servidor_mudo_entra_en_fallidos_sin_excepcion(self) -> None:
        """Un servidor que no contesta se declara, no revienta la herramienta."""

        mudo = self.arrancar_servidor(mudo=True)
        bueno = self.arrancar_servidor(desvio_ns=0)
        resultado = medir(
            (mudo.direccion, bueno.direccion),
            muestras_por_servidor=3,
            timeout_s=0.2,
            limite_ms=50.0,
        )
        self.assertIn(mudo.direccion, resultado.servidores_fallidos)
        self.assertTrue(resultado.servidores_fallidos[mudo.direccion])
        self.assertIn("sin respuesta", resultado.servidores_fallidos[mudo.direccion])
        self.assertIn(bueno.direccion, resultado.servidores_ok)
        self.assertIn(resultado.veredicto, ESTADOS_VALIDOS)

    def test_red_bloqueada_no_fabrica_un_pass(self) -> None:
        """Con todo mudo —UDP/123 bloqueado— el resultado es UNKNOWN, nunca PASS."""

        primero = self.arrancar_servidor(mudo=True)
        segundo = self.arrancar_servidor(mudo=True)
        resultado = medir(
            (primero.direccion, segundo.direccion),
            muestras_por_servidor=2,
            timeout_s=0.2,
        )
        self.assertEqual(resultado.veredicto, DESCONOCIDO)
        self.assertIsNone(resultado.theta_ns)
        self.assertIsNone(resultado.incertidumbre_ns)
        self.assertEqual(len(resultado.servidores_fallidos), 2)
        self.assertTrue(resultado.motivo)

    def test_leap_de_alarma_no_produce_pass(self) -> None:
        """Dos servidores en alarma no son dos fuentes: son dos negativas."""

        primero = self.arrancar_servidor(leap=3)
        segundo = self.arrancar_servidor(leap=3)
        resultado = medir(
            (primero.direccion, segundo.direccion),
            muestras_por_servidor=2,
            timeout_s=1.0,
        )
        self.assertNotEqual(resultado.veredicto, PASS)
        self.assertEqual(resultado.veredicto, DESCONOCIDO)
        self.assertEqual(resultado.muestras, [])
        for motivo in resultado.servidores_fallidos.values():
            self.assertIn("salto", motivo.lower())


class PruebasQuorum(BaseSonda):
    def test_un_solo_servidor_da_unknown(self) -> None:
        """Con una sola fuente no hay forma de detectar que esa fuente miente."""

        servidor = self.arrancar_servidor(desvio_ns=0, root_dispersion_ns=_NS_POR_MS)
        resultado = medir((servidor.direccion,), muestras_por_servidor=3, timeout_s=1.0)
        self.assertEqual(resultado.veredicto, DESCONOCIDO)
        self.assertIn("cuórum", resultado.motivo.lower())
        self.assertIsNone(resultado.theta_ns)
        self.assertGreaterEqual(QUORUM_MINIMO, 2)

    def test_el_mismo_servidor_repetido_no_hace_quorum(self) -> None:
        """La misma fuente escrita dos veces no son dos opiniones independientes."""

        servidor = self.arrancar_servidor(desvio_ns=0)
        resultado = medir(
            (servidor.direccion, servidor.direccion),
            muestras_por_servidor=2,
            timeout_s=1.0,
        )
        self.assertEqual(resultado.veredicto, DESCONOCIDO)
        self.assertIn("cuórum", resultado.motivo.lower())

    def test_dos_servidores_que_discrepan_dan_unknown(self) -> None:
        """Bandas disjuntas: alguno miente y no se puede saber cuál. Nunca PASS."""

        honesto = self.arrancar_servidor(desvio_ns=0, root_dispersion_ns=_NS_POR_MS)
        mentiroso = self.arrancar_servidor(
            desvio_ns=2_000 * _NS_POR_MS, root_dispersion_ns=_NS_POR_MS
        )
        resultado = medir(
            (honesto.direccion, mentiroso.direccion),
            muestras_por_servidor=3,
            timeout_s=1.0,
            limite_ms=50.0,
        )
        self.assertNotEqual(resultado.veredicto, PASS)
        self.assertEqual(resultado.veredicto, DESCONOCIDO)
        self.assertIn("miente", resultado.motivo.lower())
        self.assertIsNone(resultado.theta_ns)


class PruebasCriterio(BaseSonda):
    def test_la_incertidumbre_se_suma_y_convierte_un_pass_en_fail(self) -> None:
        """LA prueba que separa esta sonda del gate vigente.

        Offset de 40 ms e incertidumbre de 20 ms contra un límite de 50 ms:

        - Criterio del gate actual, |offset| <= L:  40 <= 50  =>  PASS.
        - Criterio correcto, |offset| + u <= L:     60 >  50  =>  FAIL.

        Es exactamente la forma del fallo de campo: 17,478 ms aprobados
        mientras la propia fuente declaraba unos ±145 ms de incertidumbre.
        """

        desvio_ns = 40 * _NS_POR_MS
        dispersion_ns = 20 * _NS_POR_MS
        primero = self.arrancar_servidor(desvio_ns=desvio_ns, root_dispersion_ns=dispersion_ns)
        segundo = self.arrancar_servidor(desvio_ns=desvio_ns, root_dispersion_ns=dispersion_ns)

        resultado = medir(
            (primero.direccion, segundo.direccion),
            muestras_por_servidor=3,
            timeout_s=1.0,
            limite_ms=50.0,
        )

        self.assertIsNotNone(resultado.theta_ns)
        self.assertIsNotNone(resultado.incertidumbre_ns)
        assert resultado.theta_ns is not None and resultado.incertidumbre_ns is not None

        # El gate vigente habría aprobado esto.
        self.assertLessEqual(abs(resultado.theta_ns), 50 * _NS_POR_MS)
        # La incertidumbre medida es la que el servidor declara, unos 20 ms.
        self.assertGreaterEqual(resultado.incertidumbre_ns, dispersion_ns)
        # Y el criterio correcto lo rechaza.
        self.assertEqual(resultado.veredicto, FAIL)
        self.assertGreater(
            abs(resultado.theta_ns) + resultado.incertidumbre_ns, 50 * _NS_POR_MS
        )

    def test_reloj_bueno_con_banda_estrecha_pasa(self) -> None:
        """La sonda sí puede aprobar: si no, no sería un instrumento, sería un no."""

        primero = self.arrancar_servidor(desvio_ns=_NS_POR_MS, root_dispersion_ns=_NS_POR_MS)
        segundo = self.arrancar_servidor(desvio_ns=_NS_POR_MS, root_dispersion_ns=_NS_POR_MS)
        resultado = medir(
            (primero.direccion, segundo.direccion),
            muestras_por_servidor=3,
            timeout_s=1.0,
            limite_ms=50.0,
        )
        self.assertEqual(resultado.veredicto, PASS, resultado.motivo)
        self.assertEqual(resultado.limite_ms, 50.0)
        self.assertIn("NUNCA", resultado.motivo)

    def test_limite_viaja_dentro_del_resultado(self) -> None:
        """El límite se declara en el artefacto, no se codifica implícitamente."""

        servidor = self.arrancar_servidor()
        resultado = medir((servidor.direccion,), muestras_por_servidor=1, timeout_s=1.0, limite_ms=7.5)
        self.assertEqual(resultado.limite_ms, 7.5)
        self.assertEqual(informe_json(resultado)["limite_ms"], 7.5)

    def test_argumentos_imposibles(self) -> None:
        with self.assertRaises(ValueError):
            medir(("127.0.0.1:1",), muestras_por_servidor=0)
        with self.assertRaises(ValueError):
            medir(("127.0.0.1:1",), limite_ms=0.0)


# --------------------------------------------------------------------------- #
# Salidas
# --------------------------------------------------------------------------- #


class PruebasSalidas(BaseSonda):
    def _resultado_con_muestras(self, *, muestras_por_servidor: int = 3):
        primero = self.arrancar_servidor(desvio_ns=_NS_POR_MS)
        segundo = self.arrancar_servidor(desvio_ns=2 * _NS_POR_MS)
        return medir(
            (primero.direccion, segundo.direccion),
            muestras_por_servidor=muestras_por_servidor,
            timeout_s=1.0,
        )

    def test_jsonl_una_linea_por_muestra(self) -> None:
        resultado = self._resultado_con_muestras(muestras_por_servidor=3)
        self.assertEqual(len(resultado.muestras), 6)
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "muestras.jsonl"
            escribir_muestras_jsonl(resultado, destino)
            texto = destino.read_text(encoding="utf-8")
        lineas = [linea for linea in texto.splitlines() if linea.strip()]
        self.assertEqual(len(lineas), len(resultado.muestras))
        registros = [json.loads(linea) for linea in lineas]
        for registro in registros:
            self.assertIn("servidor", registro)
            self.assertIn("theta_ns", registro)
            self.assertIn("delta_ns", registro)
            self.assertIn("incertidumbre_ns", registro)
        # Exactamente una elegida por servidor: la de menor delta.
        elegidas = [r for r in registros if r["elegida"]]
        self.assertEqual(len(elegidas), 2)
        self.assertEqual({r["servidor"] for r in elegidas}, set(resultado.servidores_ok))

    def test_jsonl_se_escribe_de_forma_atomica_sobre_un_archivo_previo(self) -> None:
        """Reescribir no puede dejar nunca un archivo a medias ni restos .tmp."""

        resultado = self._resultado_con_muestras(muestras_por_servidor=2)
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "muestras.jsonl"
            destino.write_text("basura previa\n", encoding="utf-8")
            escribir_muestras_jsonl(resultado, destino)
            lineas = [l for l in destino.read_text(encoding="utf-8").splitlines() if l.strip()]
            self.assertEqual(len(lineas), len(resultado.muestras))
            self.assertNotIn("basura", destino.read_text(encoding="utf-8"))
            sobrantes = [p.name for p in Path(carpeta).iterdir() if p.name != destino.name]
            self.assertEqual(sobrantes, [])

    def test_informe_json_es_serializable_y_declara_lo_que_no_demuestra(self) -> None:
        resultado = self._resultado_con_muestras(muestras_por_servidor=2)
        informe = informe_json(resultado)
        json.dumps(informe, ensure_ascii=False)  # no debe lanzar
        self.assertEqual(informe["herramienta"], "sonda_reloj")
        self.assertIn(informe["veredicto"], ESTADOS_VALIDOS)
        self.assertTrue(informe["motivo"])
        self.assertIn("incertidumbre", informe["criterio"])
        self.assertIn("NUNCA", informe["no_demuestra"])
        self.assertEqual(informe["quorum_minimo"], QUORUM_MINIMO)
        self.assertEqual(len(informe["elegidas_por_servidor"]), 2)

    def test_informe_json_sin_medida_no_pone_ceros(self) -> None:
        """Sin medición, null. Un cero se leería como «el reloj está perfecto»."""

        mudo = self.arrancar_servidor(mudo=True)
        resultado = medir((mudo.direccion,), muestras_por_servidor=2, timeout_s=0.2)
        informe = informe_json(resultado)
        self.assertEqual(informe["veredicto"], DESCONOCIDO)
        self.assertIsNone(informe["theta_ms"])
        self.assertIsNone(informe["incertidumbre_ms"])
        self.assertIsNone(informe["suma_ms"])

    def test_informe_texto_es_legible_y_muestra_la_aritmetica(self) -> None:
        resultado = self._resultado_con_muestras(muestras_por_servidor=2)
        texto = informe_texto(resultado)
        self.assertIn("SONDA DE RELOJ SNTP", texto)
        self.assertIn(f"VEREDICTO: {resultado.veredicto}", texto)
        self.assertIn("CRITERIO APLICADO", texto)
        self.assertIn("Incertidumbre", texto)
        self.assertIn("LO QUE ESTE RESULTADO NO DICE", texto)
        # Coma decimal, como el resto de los textos del proyecto.
        self.assertIn(",", texto)

    def test_no_se_escribe_dentro_de_runs(self) -> None:
        """Regla 1: la evidencia de runs/ es intocable, tampoco para las salidas."""

        resultado = self._resultado_con_muestras(muestras_por_servidor=1)
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "runs" / "muestras.jsonl"
            with self.assertRaises(ValueError):
                escribir_muestras_jsonl(resultado, destino)
            self.assertFalse(destino.exists())


class PruebasConstantes(unittest.TestCase):
    def test_constantes_publicas(self) -> None:
        self.assertEqual(PUERTO_NTP, 123)
        self.assertEqual(EPOCA_NTP, 2208988800)
        self.assertEqual(len(SERVIDORES_POR_DEFECTO), 3)
        self.assertEqual(len(set(SERVIDORES_POR_DEFECTO)), 3)
        self.assertEqual(LIMITE_POR_OMISION_MS, 50.0)
        self.assertEqual(PASS, "PASS")
        self.assertEqual(FAIL, "FAIL")
        self.assertEqual(DESCONOCIDO, "UNKNOWN")


if __name__ == "__main__":  # pragma: no cover
    unittest.main(verbosity=2)
