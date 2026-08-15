"""Pruebas del detector de saltos del reloj de pared.

Se ejecutan con la biblioteca estándar, sin instalar nada:

    cd herramientas && python3 -m unittest discover -s tests -v

Los CSV son sintéticos y se escriben en carpetas temporales. Ninguna prueba
toca la evidencia real: la única que la lee lo hace en modo solo lectura y
está desactivada salvo que se pida expresamente con la variable de entorno
``JF_EVIDENCIA_REAL``, porque recorre 450 MB.
"""

from __future__ import annotations

import csv
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Permite ejecutar las pruebas también desde fuera de la carpeta herramientas.
_RAIZ = Path(__file__).resolve().parent.parent
if str(_RAIZ) not in sys.path:
    sys.path.insert(0, str(_RAIZ))

from jf_evidencia.comun import DESCONOCIDO, ESTADOS_VALIDOS, FAIL, PASS, sha256_de
from jf_evidencia.detector_saltos import (
    CUANTO_WINDOWS_MS,
    FACTOR_UMBRAL,
    FILAS_MINIMAS_UTILES,
    UMBRAL_POR_OMISION_MS,
    Serie,
    analizar_captura,
    analizar_csv,
    informe_json,
    informe_texto,
    veredicto,
)

# Cabecera real del esquema 2.0.0, copiada del CSV de campo
# runs/20260814T081136_503806Z_10m_d64fea5560ac/capture/spot/events-*.csv.
CABECERA_REAL = [
    "schema_version",
    "capture_session_id",
    "ingest_seq",
    "source_socket_id",
    "local_event_id",
    "row_index",
    "record_type",
    "exchange",
    "market",
    "symbol",
    "channel",
    "connection_id",
    "book_generation",
    "exchange_event_time_ms",
    "exchange_trade_time_ms",
    "exchange_transaction_time_ms",
    "receive_time_utc_ns",
    "receive_time_monotonic_ns",
    "writer_start_time_utc_ns",
    "writer_start_time_monotonic_ns",
    "exchange_to_receive_ns",
    "receive_to_writer_start_ns",
    "sequence_first",
    "sequence_last",
    "sequence_previous",
    "level_count",
    "side",
    "price",
    "quantity",
    "aggregate_trade_id",
    "first_trade_id",
    "last_trade_id",
    "buyer_is_maker",
    "payload_bytes",
    "raw_queue_size",
    "note",
]

# Valores tomados de la primera fila real de esa corrida, para que las series
# sintéticas vivan en el mismo orden de magnitud que la evidencia.
BASE_UTC_NS = 1786695099204754200
BASE_MONOTONICO_NS = 17199265000000
PASO_FILA_NS = 1_000_000  # una fila por milisegundo
CUANTO_NS = 15_625_000  # 15,625 ms del cronómetro de Windows
FILAS_POR_OMISION = 500


def _fila(valores: dict[str, object]) -> list[str]:
    """Construye una fila completa del esquema real con los campos indicados."""

    return [str(valores.get(columna, "")) for columna in CABECERA_REAL]


def _escribir_csv(ruta: Path, filas: list[list[str]], *, cabecera: list[str] | None = None) -> None:
    """Escribe un CSV sintético con la misma configuración que el motor."""

    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="") as manejador:
        escritor = csv.writer(manejador)
        escritor.writerow(cabecera if cabecera is not None else CABECERA_REAL)
        escritor.writerows(filas)


def _filas_constantes(
    total: int = FILAS_POR_OMISION,
    *,
    mercado: str = "spot",
    salto_en: int | None = None,
    salto_ns: int = 0,
) -> list[list[str]]:
    """Serie con D constante; opcionalmente con un salto del reloj inyectado.

    A partir de la fila ``salto_en`` se suma ``salto_ns`` al reloj de pared y no
    al cronómetro, que es exactamente lo que hace un ajuste escalonado real: el
    monotónico no se entera.
    """

    filas: list[list[str]] = []
    for indice in range(total):
        transcurrido = indice * PASO_FILA_NS
        desplazamiento = salto_ns if (salto_en is not None and indice >= salto_en) else 0
        filas.append(
            _fila(
                {
                    "schema_version": "2.0.0",
                    "market": mercado,
                    "record_type": "DEPTH",
                    "receive_time_utc_ns": BASE_UTC_NS + transcurrido + desplazamiento,
                    "receive_time_monotonic_ns": BASE_MONOTONICO_NS + transcurrido,
                }
            )
        )
    return filas


def _filas_cuantizadas(total: int = FILAS_POR_OMISION, *, mercado: str = "spot") -> list[list[str]]:
    """Serie sana de Windows: el cronómetro solo avanza en tics de 15,625 ms.

    Es el caso real de campo. D dibuja un diente de sierra de casi un cuanto de
    amplitud sin que el reloj de pared se haya movido un solo nanosegundo.
    """

    filas: list[list[str]] = []
    for indice in range(total):
        transcurrido = indice * PASO_FILA_NS
        monotonico = BASE_MONOTONICO_NS + (transcurrido // CUANTO_NS) * CUANTO_NS
        filas.append(
            _fila(
                {
                    "schema_version": "2.0.0",
                    "market": mercado,
                    "record_type": "DEPTH",
                    "receive_time_utc_ns": BASE_UTC_NS + transcurrido,
                    "receive_time_monotonic_ns": monotonico,
                }
            )
        )
    return filas


def _serie_sintetica(*, sospechoso: bool = False, filas: int = 1000, **extra: object) -> Serie:
    """Construye una ``Serie`` directamente, para probar ``veredicto`` aislado."""

    argumentos: dict[str, object] = {
        "ruta": Path("events-sintetico.csv"),
        "mercado": "spot",
        "filas": filas,
        "rango_ms": 0.0,
        "mayor_salto_ms": 900.0 if sospechoso else 1.0,
        "mediana_ns": 123,
        "umbral_ms": UMBRAL_POR_OMISION_MS,
        "sospechoso": sospechoso,
        "motivo_ilegible": None,
    }
    argumentos.update(extra)
    return Serie(**argumentos)  # type: ignore[arg-type]


class PruebaBase(unittest.TestCase):
    """Da a cada prueba su propia carpeta temporal."""

    def setUp(self) -> None:
        self._temporal = tempfile.TemporaryDirectory(prefix="jf_saltos_")
        self.addCleanup(self._temporal.cleanup)
        self.carpeta = Path(self._temporal.name)


class TestSerieSinSalto(PruebaBase):
    def test_d_constante_no_es_sospechosa_y_su_rango_es_cero(self) -> None:
        ruta = self.carpeta / "events-20260814T081139.311729Z-000001.csv"
        _escribir_csv(ruta, _filas_constantes())

        serie = analizar_csv(ruta)

        self.assertIsNotNone(serie)
        assert serie is not None
        self.assertIsNone(serie.motivo_ilegible)
        self.assertEqual(serie.filas, FILAS_POR_OMISION)
        self.assertEqual(serie.filas_descartadas, 0)
        self.assertEqual(serie.rango_ms, 0.0)
        self.assertEqual(serie.mayor_salto_ms, 0.0)
        self.assertFalse(serie.sospechoso)
        self.assertEqual(serie.mediana_ns, BASE_UTC_NS - BASE_MONOTONICO_NS)
        self.assertEqual(serie.mercado, "spot")
        self.assertEqual(serie.umbral_ms, UMBRAL_POR_OMISION_MS)
        self.assertEqual(serie.paso_muestreo, 1, "500 filas caben sin muestrear")

    def test_el_umbral_por_omision_es_tres_cuantos(self) -> None:
        self.assertEqual(FACTOR_UMBRAL, 3.0)
        self.assertEqual(CUANTO_WINDOWS_MS, 15.625)
        self.assertAlmostEqual(UMBRAL_POR_OMISION_MS, 46.875, places=6)
        self.assertLess(
            UMBRAL_POR_OMISION_MS,
            50.0,
            "el umbral debe quedar por debajo del límite de 50 ms que el proyecto "
            "usa como referencia, o dejaría pasar saltos que sí le importan",
        )


class TestCuantizacionDeWindows(PruebaBase):
    def test_los_tics_de_15625_ms_no_se_confunden_con_un_salto(self) -> None:
        """El caso real de campo: rango de unos 15 ms y ninguna sospecha."""

        ruta = self.carpeta / "events-cuantizado.csv"
        _escribir_csv(ruta, _filas_cuantizadas())

        serie = analizar_csv(ruta)

        self.assertIsNotNone(serie)
        assert serie is not None
        self.assertIsNone(serie.motivo_ilegible)
        self.assertGreater(
            serie.rango_ms, 10.0, "la cuantización simulada tiene que notarse en el rango"
        )
        self.assertLess(serie.rango_ms, CUANTO_WINDOWS_MS + 0.001)
        self.assertLess(serie.mayor_salto_ms, UMBRAL_POR_OMISION_MS)
        self.assertFalse(
            serie.sospechoso,
            "un cronómetro que avanza a tics no es un salto del reloj de pared",
        )
        self.assertEqual(veredicto([serie])[0], PASS)


class TestSaltoInyectado(PruebaBase):
    def test_un_salto_de_373_ms_se_detecta_y_se_mide(self) -> None:
        ruta = self.carpeta / "events-con-salto.csv"
        _escribir_csv(ruta, _filas_constantes(salto_en=250, salto_ns=373_000_000))

        serie = analizar_csv(ruta)

        self.assertIsNotNone(serie)
        assert serie is not None
        self.assertIsNone(serie.motivo_ilegible)
        self.assertAlmostEqual(serie.mayor_salto_ms, 373.0, delta=0.001)
        self.assertAlmostEqual(serie.rango_ms, 373.0, delta=0.001)
        self.assertTrue(serie.sospechoso)

        estado, motivo = veredicto([serie])
        self.assertEqual(estado, FAIL)
        self.assertIn("373", motivo)

    def test_un_salto_hacia_atras_tambien_se_detecta(self) -> None:
        """Un reloj que retrocede es el caso que puede desordenar segmentos."""

        ruta = self.carpeta / "events-retroceso.csv"
        _escribir_csv(ruta, _filas_constantes(salto_en=300, salto_ns=-373_000_000))

        serie = analizar_csv(ruta)

        assert serie is not None
        self.assertAlmostEqual(serie.mayor_salto_ms, 373.0, delta=0.001)
        self.assertTrue(serie.sospechoso)

    def test_un_salto_por_debajo_del_umbral_no_se_afirma(self) -> None:
        """Diez milisegundos quedan bajo la resolución: no se puede afirmar nada."""

        ruta = self.carpeta / "events-salto-pequeno.csv"
        _escribir_csv(ruta, _filas_constantes(salto_en=250, salto_ns=10_000_000))

        serie = analizar_csv(ruta)

        assert serie is not None
        self.assertFalse(serie.sospechoso)
        self.assertAlmostEqual(serie.mayor_salto_ms, 10.0, delta=0.001)


class TestEntradaMalFormada(PruebaBase):
    def test_csv_sin_las_columnas_necesarias_no_revienta(self) -> None:
        ruta = self.carpeta / "events-sin-columnas.csv"
        _escribir_csv(
            ruta,
            [["2.0.0", "spot"], ["2.0.0", "spot"]],
            cabecera=["schema_version", "market"],
        )

        serie = analizar_csv(ruta)

        if serie is not None:
            self.assertIsNotNone(serie.motivo_ilegible)
            assert serie.motivo_ilegible is not None
            self.assertIn("receive_time_utc_ns", serie.motivo_ilegible)
            self.assertFalse(
                serie.sospechoso, "no se midió nada, así que no hay nada que sospechar"
            )
            self.assertEqual(veredicto([serie])[0], DESCONOCIDO)

    def test_fila_corrupta_en_medio_se_salta_y_el_recorrido_sigue(self) -> None:
        filas = _filas_constantes()
        filas[250] = ["solo", "dos"]  # fila truncada
        filas[251][CABECERA_REAL.index("receive_time_utc_ns")] = "no-es-un-numero"
        ruta = self.carpeta / "events-fila-corrupta.csv"
        _escribir_csv(ruta, filas)

        serie = analizar_csv(ruta)  # no debe lanzar

        self.assertIsNotNone(serie)
        assert serie is not None
        self.assertIsNone(serie.motivo_ilegible)
        self.assertEqual(serie.filas, FILAS_POR_OMISION - 2)
        self.assertEqual(serie.filas_descartadas, 2)
        self.assertEqual(serie.rango_ms, 0.0)
        self.assertFalse(serie.sospechoso)
        self.assertFalse(serie.cobertura_dudosa, "dos de quinientas no es cobertura dudosa")
        self.assertEqual(veredicto([serie])[0], PASS)

    def test_muchas_filas_descartadas_impiden_un_pass(self) -> None:
        filas = _filas_constantes(total=1000)
        indice_utc = CABECERA_REAL.index("receive_time_utc_ns")
        for posicion in range(0, 1000, 4):  # una de cada cuatro, un 25 %
            filas[posicion][indice_utc] = ""
        ruta = self.carpeta / "events-muchos-descartes.csv"
        _escribir_csv(ruta, filas)

        serie = analizar_csv(ruta)

        assert serie is not None
        self.assertTrue(serie.cobertura_dudosa)
        estado, motivo = veredicto([serie])
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("cobertura", motivo)

    def test_archivo_vacio_y_solo_cabecera_son_ilegibles(self) -> None:
        vacio = self.carpeta / "events-vacio.csv"
        vacio.write_text("", encoding="utf-8")
        solo_cabecera = self.carpeta / "events-solo-cabecera.csv"
        _escribir_csv(solo_cabecera, [])

        serie_vacia = analizar_csv(vacio)
        serie_cabecera = analizar_csv(solo_cabecera)

        assert serie_vacia is not None and serie_cabecera is not None
        self.assertIsNotNone(serie_vacia.motivo_ilegible)
        self.assertIsNotNone(serie_cabecera.motivo_ilegible)

    def test_ruta_inexistente_devuelve_none(self) -> None:
        self.assertIsNone(analizar_csv(self.carpeta / "no-existe.csv"))
        self.assertIsNone(analizar_csv(self.carpeta))

    def test_byte_no_utf8_en_una_columna_de_texto_no_ciega_al_detector(self) -> None:
        """La lección del 0xE9: un byte de cp1252 no debe impedir la medición."""

        ruta = self.carpeta / "events-cp1252.csv"
        _escribir_csv(ruta, _filas_constantes())

        # Última fila con una 'é' codificada en cp1252 (byte 0xE9) en la nota,
        # exactamente el byte que hizo caer los replays de la sesión d64fea5560ac.
        fila = _fila(
            {
                "schema_version": "2.0.0",
                "market": "spot",
                "receive_time_utc_ns": BASE_UTC_NS,
                "receive_time_monotonic_ns": BASE_MONOTONICO_NS,
                "note": "SESION",
            }
        )
        crudo = ",".join(fila).encode("ascii").replace(b"SESION", b"SESI\xe9N")
        with ruta.open("ab") as manejador:
            manejador.write(crudo + b"\r\n")

        serie = analizar_csv(ruta)

        assert serie is not None
        self.assertIsNone(
            serie.motivo_ilegible,
            "las dos columnas que se leen son dígitos ASCII: un byte ilegible en "
            "una columna de texto no puede cegar al detector",
        )
        self.assertEqual(serie.filas, FILAS_POR_OMISION + 1)
        self.assertFalse(serie.sospechoso)

    def test_umbral_invalido_es_un_error_del_que_llama(self) -> None:
        ruta = self.carpeta / "events-umbral.csv"
        _escribir_csv(ruta, _filas_constantes())
        for malo in (0.0, -1.0, float("nan"), float("inf")):
            with self.subTest(umbral=malo):
                with self.assertRaises(ValueError):
                    analizar_csv(ruta, umbral_ms=malo)


class TestSoloLectura(PruebaBase):
    def test_el_csv_de_entrada_no_se_modifica(self) -> None:
        """Regla 1: la evidencia es intocable. Se comprueba, no se promete."""

        ruta = self.carpeta / "events-intacto.csv"
        _escribir_csv(ruta, _filas_constantes(salto_en=100, salto_ns=373_000_000))

        antes = ruta.stat()
        sello_antes = sha256_de(ruta)

        serie = analizar_csv(ruta)
        analizar_captura(self.carpeta)
        informe_texto([serie] if serie else [])
        informe_json([serie] if serie else [])

        despues = ruta.stat()
        self.assertEqual(antes.st_size, despues.st_size, "el tamaño cambió")
        self.assertEqual(antes.st_mtime_ns, despues.st_mtime_ns, "la fecha de modificación cambió")
        self.assertEqual(sello_antes, sha256_de(ruta), "el contenido cambió")
        self.assertTrue(ruta.is_file(), "el archivo se renombró o se borró")

    def test_analizar_captura_no_crea_archivos(self) -> None:
        (self.carpeta / "spot").mkdir()
        _escribir_csv(self.carpeta / "spot" / "events-000001.csv", _filas_constantes())
        antes = sorted(p.name for p in self.carpeta.rglob("*"))

        analizar_captura(self.carpeta)

        self.assertEqual(antes, sorted(p.name for p in self.carpeta.rglob("*")))


class TestAnalizarCaptura(PruebaBase):
    def _construir_capture(self) -> Path:
        capture = self.carpeta / "capture"
        _escribir_csv(
            capture / "spot" / "events-20260814T081139.311729Z-000001.csv",
            _filas_constantes(mercado="spot"),
        )
        _escribir_csv(
            capture / "usdm_futures" / "events-20260814T081139.839103Z-000001.csv",
            _filas_cuantizadas(mercado="usdm_futures"),
        )
        return capture

    def test_recorre_los_dos_mercados(self) -> None:
        capture = self._construir_capture()

        series = analizar_captura(capture)

        self.assertEqual(len(series), 2)
        self.assertEqual([s.mercado for s in series], ["spot", "usdm_futures"])
        self.assertTrue(all(s.motivo_ilegible is None for s in series))
        self.assertEqual(veredicto(series)[0], PASS)

    def test_tambien_analiza_un_segmento_partial(self) -> None:
        """Una corrida interrumpida deja ``.csv.partial``: también es evidencia."""

        capture = self._construir_capture()
        _escribir_csv(
            capture / "spot" / "events-20260814T081239.000000Z-000002.csv.partial",
            _filas_constantes(mercado="spot"),
        )

        series = analizar_captura(capture)

        self.assertEqual(len(series), 3)
        self.assertTrue(any(s.ruta.name.endswith(".partial") for s in series))

    def test_carpeta_inexistente_devuelve_lista_vacia(self) -> None:
        self.assertEqual(analizar_captura(self.carpeta / "no-existe"), [])

    def test_un_mercado_con_salto_hace_fallar_el_conjunto(self) -> None:
        capture = self._construir_capture()
        _escribir_csv(
            capture / "usdm_futures" / "events-20260814T081239.000000Z-000002.csv",
            _filas_constantes(mercado="usdm_futures", salto_en=200, salto_ns=373_000_000),
        )

        estado, motivo = veredicto(analizar_captura(capture))

        self.assertEqual(estado, FAIL)
        self.assertIn("usdm_futures", motivo)


class TestVeredicto(unittest.TestCase):
    def test_lista_vacia_es_desconocido_con_motivo(self) -> None:
        estado, motivo = veredicto([])

        self.assertEqual(estado, DESCONOCIDO)
        self.assertTrue(motivo.strip(), "el motivo nunca puede ir vacío")
        self.assertIn("NO demuestra", motivo)

    def test_nunca_devuelve_pass_si_alguna_serie_es_sospechosa(self) -> None:
        combinaciones = (
            [_serie_sintetica(sospechoso=True)],
            [_serie_sintetica(), _serie_sintetica(sospechoso=True)],
            [
                _serie_sintetica(sospechoso=True),
                _serie_sintetica(
                    motivo_ilegible="no es UTF-8 válido", filas=0, mayor_salto_ms=0.0
                ),
            ],
            [_serie_sintetica(sospechoso=True, filas=3)],
        )
        for series in combinaciones:
            with self.subTest(series=len(series)):
                estado, motivo = veredicto(list(series))
                self.assertNotEqual(estado, PASS)
                self.assertEqual(estado, FAIL)
                self.assertTrue(motivo.strip())

    def test_serie_demasiado_corta_es_desconocido(self) -> None:
        estado, motivo = veredicto([_serie_sintetica(filas=FILAS_MINIMAS_UTILES - 1)])

        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("resolución útil", motivo)

    def test_una_serie_ilegible_impide_el_pass(self) -> None:
        series = [
            _serie_sintetica(),
            _serie_sintetica(
                motivo_ilegible="contiene un rastro de excepción de Python",
                filas=0,
                mayor_salto_ms=0.0,
            ),
        ]

        estado, motivo = veredicto(series)

        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("rastro de excepción", motivo)

    def test_deriva_sin_escalon_no_es_pass_ni_fail(self) -> None:
        """Un ajuste gradual no es un escalón, pero tampoco es un reloj quieto."""

        serie = _serie_sintetica(rango_ms=120.0, mayor_salto_ms=1.0)

        estado, motivo = veredicto([serie])

        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("gradual", motivo)

    def test_el_pass_lleva_escrita_su_limitacion(self) -> None:
        estado, motivo = veredicto([_serie_sintetica()])

        self.assertEqual(estado, PASS)
        self.assertIn("NO demuestra", motivo)


class TestInformes(PruebaBase):
    def _series(self) -> list[Serie]:
        ruta = self.carpeta / "events-informe.csv"
        _escribir_csv(ruta, _filas_cuantizadas())
        serie = analizar_csv(ruta)
        assert serie is not None
        return [serie]

    def test_informe_texto_enuncia_las_tres_limitaciones(self) -> None:
        texto = informe_texto(self._series())

        self.assertIn("NO demuestra", texto)
        self.assertIn("15,625 ms", texto)
        self.assertIn("hueco", texto)
        self.assertIn("preflight", texto)
        self.assertIn("VEREDICTO: PASS", texto)

    def test_informe_texto_es_representable_en_cp1252(self) -> None:
        """La consola de Windows en español escribe en cp1252.

        La sesión d64fea5560ac perdió su ``audit_metrics.json`` porque al
        imprimir el informe apareció una θ que cp1252 no sabe escribir
        (``UnicodeEncodeError`` en ``audit.py:1180``). Ningún texto de esta
        herramienta puede repetir ese fallo.
        """

        for series in (self._series(), [], [_serie_sintetica(sospechoso=True)]):
            with self.subTest(series=len(series)):
                informe_texto(series).encode("cp1252")

    def test_informe_texto_con_lista_vacia_no_revienta(self) -> None:
        texto = informe_texto([])

        self.assertIn("UNKNOWN", texto)
        self.assertIn("NO demuestra", texto)

    def test_informe_json_es_serializable_y_declara_lo_que_no_prueba(self) -> None:
        informe = informe_json(self._series())

        crudo = json.dumps(informe, ensure_ascii=False)  # no debe lanzar
        self.assertIn("no_demuestra", crudo)
        self.assertIn(informe["estado"], ESTADOS_VALIDOS)
        self.assertEqual(len(informe["limitaciones"]), 3)
        self.assertEqual(informe["series_analizadas"], 1)
        self.assertAlmostEqual(informe["umbral_por_omision_ms"], 46.875, places=6)
        self.assertTrue(informe["motivo"].strip())

    def test_informe_json_no_inventa_ceros_para_una_serie_ilegible(self) -> None:
        serie = _serie_sintetica(
            motivo_ilegible="faltan las columnas receive_time_utc_ns", filas=0
        )

        informe = informe_json([serie])
        entrada = informe["series"][0]

        self.assertFalse(entrada["medida"])
        for campo in ("filas", "rango_ms", "mayor_salto_ms", "mediana_ns"):
            with self.subTest(campo=campo):
                self.assertIsNone(
                    entrada[campo],
                    "un cero se leería como una medición, y aquí no hubo ninguna",
                )


@unittest.skipUnless(
    os.environ.get("JF_EVIDENCIA_REAL"),
    "recorre 450 MB de evidencia real; se activa con JF_EVIDENCIA_REAL=1",
)
class TestEvidenciaReal(unittest.TestCase):
    RUTA = Path(
        os.environ.get("JF_EVIDENCIA_REAL_CAPTURE", "")
        or "/tmp/claude-0/-home-user-claude/ed460f64-92d2-523b-bae6-9d78269266ab/scratchpad"
        "/unz/IDEAS/IDEAS555/555/binance_phase1_collector/runs"
        "/20260814T081136_503806Z_10m_d64fea5560ac/capture"
    )

    def test_reproduce_la_medicion_de_campo(self) -> None:
        if not self.RUTA.is_dir():
            self.skipTest(f"no está la evidencia real en {self.RUTA}")

        sellos = {p: sha256_de(p) for p in sorted(self.RUTA.rglob("*.csv"))}
        series = analizar_captura(self.RUTA)

        por_mercado = {s.mercado: s for s in series}
        self.assertIn("spot", por_mercado)
        self.assertIn("usdm_futures", por_mercado)
        self.assertEqual(por_mercado["spot"].filas, 418_095)
        self.assertEqual(por_mercado["usdm_futures"].filas, 799_714)
        self.assertAlmostEqual(por_mercado["spot"].rango_ms, 19.325, delta=0.01)
        self.assertAlmostEqual(por_mercado["spot"].mayor_salto_ms, 15.922, delta=0.01)
        self.assertAlmostEqual(por_mercado["usdm_futures"].rango_ms, 19.896, delta=0.01)
        self.assertAlmostEqual(por_mercado["usdm_futures"].mayor_salto_ms, 16.094, delta=0.01)
        self.assertFalse(any(s.sospechoso for s in series))
        self.assertEqual(veredicto(series)[0], PASS)
        self.assertEqual(sellos, {p: sha256_de(p) for p in sellos}, "la evidencia cambió")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
