"""Pruebas de ``jf_evidencia.localizar``.

Todas construyen su propio árbol falso con ``tempfile``. Ninguna depende de la
evidencia de campo, de la red ni del reloj real.

La prueba que más importa aquí no es ninguna de las de emparejado: es
``test_inventariar_no_escribe_nada_en_el_arbol``. La regla número uno del
proyecto es que ``runs/`` es de solo lectura, y una regla que no se comprueba no
es una regla, es una intención.
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from jf_evidencia import localizar
from jf_evidencia.comun import DESCONOCIDO, FAIL, PASS, sha256_de

TRACEBACK_FALSO = (
    "Traceback (most recent call last):\n"
    '  File "launcher.py", line 1180, in <module>\n'
    "    print(resultado)\n"
    "UnicodeEncodeError: 'charmap' codec can't encode characters in position 538-539\n"
)


def _crear_runs(base: Path, instalacion: str) -> Path:
    """Crea ``base/<instalacion>/binance_phase1_collector/runs`` y la devuelve."""

    runs = base / instalacion / "binance_phase1_collector" / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    return runs


def _crear_preflight(runs: Path, marca: str, *, con_clock: bool = True) -> Path:
    carpeta = runs / f"preflight_{marca}_000000Z"
    carpeta.mkdir(parents=True, exist_ok=True)
    if con_clock:
        (carpeta / "clock_preflight.json").write_text(
            json.dumps({"pass": True, "error_code": "PASS"}), encoding="utf-8"
        )
    return carpeta


def _crear_corrida(
    runs: Path,
    marca: str,
    *,
    sufijo: str = "10m_aaaaaaaaaaaa",
    result: object | str | None = None,
    postflight: bool = False,
    metrics: bool = False,
    audit: bool = False,
) -> Path:
    """Crea una carpeta de corrida con el contenido que se le pida.

    ``result`` puede ser un objeto (se serializa a JSON), una cadena (se escribe
    tal cual, para simular un archivo ilegible) o None (no se crea el archivo).
    """

    carpeta = runs / f"{marca}_123456Z_{sufijo}"
    carpeta.mkdir(parents=True, exist_ok=True)
    if isinstance(result, str):
        (carpeta / "RESULT.json").write_text(result, encoding="utf-8")
    elif result is not None:
        (carpeta / "RESULT.json").write_text(
            json.dumps(result, ensure_ascii=False), encoding="utf-8"
        )
    if postflight:
        (carpeta / "clock_postflight.json").write_text(
            json.dumps({"pass": True}), encoding="utf-8"
        )
    if metrics or audit:
        capture = carpeta / "capture"
        capture.mkdir(exist_ok=True)
        if metrics:
            (capture / "jean_flow_metrics.jsonl").write_text("{}\n", encoding="utf-8")
        if audit:
            (capture / "audit_spot.json").write_text(
                json.dumps({"pass": False}), encoding="utf-8"
            )
    return carpeta


def _instantanea(raiz: Path) -> dict[str, str]:
    """Rutas relativas, tamaño y SHA-256 del contenido, para comparar antes y después.

    El sello del contenido no es un lujo: comparar solo nombres y tamaños dejaría
    pasar una reescritura del mismo número de bytes, que es precisamente la
    corrupción de evidencia más difícil de ver a ojo.
    """

    instantanea: dict[str, str] = {}
    for actual, subdirectorios, archivos in os.walk(raiz):
        actual_ruta = Path(actual)
        for nombre in subdirectorios:
            relativa = (actual_ruta / nombre).relative_to(raiz).as_posix()
            instantanea[relativa + "/"] = "(carpeta)"
        for nombre in archivos:
            ruta = actual_ruta / nombre
            clave = ruta.relative_to(raiz).as_posix()
            instantanea[clave] = f"{ruta.stat().st_size}:{sha256_de(ruta)}"
    return instantanea


class BaseTemporal(unittest.TestCase):
    """Cada prueba trabaja en su propio directorio temporal, que se borra al salir."""

    def setUp(self) -> None:
        self._temporal = tempfile.TemporaryDirectory(prefix="jf_localizar_")
        self.addCleanup(self._temporal.cleanup)
        self.base = Path(self._temporal.name)

    def _por_nombre(self, corridas: list[localizar.Corrida]) -> dict[str, localizar.Corrida]:
        return {corrida.nombre: corrida for corrida in corridas}


class PruebasEmparejadoPreflight(BaseTemporal):
    """El defecto exacto que corrige esta herramienta: emparejar el preflight que toca."""

    def test_cada_corrida_recibe_su_preflight_y_no_el_ultimo(self) -> None:
        runs = _crear_runs(self.base, "JF")
        pf_temprano = _crear_preflight(runs, "20260814T081000")
        pf_medio = _crear_preflight(runs, "20260814T081100")
        pf_ultimo = _crear_preflight(runs, "20260814T081200")
        _crear_corrida(runs, "20260814T081050", sufijo="10m_aaaaaaaaaaaa", result={"pass": True})
        _crear_corrida(runs, "20260814T081130", sufijo="10m_bbbbbbbbbbbb", result={"pass": True})

        corridas = localizar.inventariar(self.base)
        self.assertEqual(len(corridas), 2)
        primera, segunda = corridas

        self.assertEqual(primera.marca, "20260814T081050")
        self.assertEqual(primera.preflight, pf_temprano)
        self.assertEqual(segunda.marca, "20260814T081130")
        self.assertEqual(segunda.preflight, pf_medio)

        # Este es el fallo del .cmd: emparejar siempre el último.
        self.assertNotEqual(primera.preflight, pf_ultimo)
        self.assertNotEqual(segunda.preflight, pf_ultimo)

    def test_funcion_de_emparejado_toma_el_mayor_anterior_o_igual(self) -> None:
        preflights = [
            Path("preflight_20260814T081000_000000Z"),
            Path("preflight_20260814T081200_000000Z"),
            Path("preflight_20260814T081100_000000Z"),
        ]
        elegido = localizar.emparejar_preflight("20260814T081130", preflights)
        self.assertEqual(elegido, Path("preflight_20260814T081100_000000Z"))

    def test_marca_igual_se_considera_valida(self) -> None:
        preflights = [Path("preflight_20260814T081136_000000Z")]
        elegido = localizar.emparejar_preflight("20260814T081136", preflights)
        self.assertEqual(elegido, preflights[0])

    def test_sin_preflight_anterior_devuelve_none(self) -> None:
        preflights = [Path("preflight_20260814T090000_000000Z")]
        self.assertIsNone(localizar.emparejar_preflight("20260814T080000", preflights))

    def test_sin_marca_de_corrida_devuelve_none(self) -> None:
        preflights = [Path("preflight_20260814T080000_000000Z")]
        self.assertIsNone(localizar.emparejar_preflight(None, preflights))

    def test_lista_de_preflights_vacia_devuelve_none(self) -> None:
        self.assertIsNone(localizar.emparejar_preflight("20260814T081136", []))

    def test_corrida_sin_preflight_anterior_declara_ausente_el_clock_preflight(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T090000")
        _crear_corrida(runs, "20260814T080000", result={"pass": False})

        corrida = localizar.inventariar(self.base)[0]
        self.assertIsNone(corrida.preflight)
        self.assertFalse(corrida.archivos_clave["clock_preflight.json"])
        self.assertIn("clock_preflight.json", corrida.archivos_faltantes)


class PruebasVeredicto(BaseTemporal):
    """El veredicto se relee del RESULT.json; nunca se rellena por omisión."""

    def test_result_ilegible_deja_passed_none_con_motivo_y_es_candidata(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result=TRACEBACK_FALSO)

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertTrue(corrida.tiene_result)
        self.assertIsNone(corrida.passed)
        self.assertIsNotNone(corrida.motivo_ilegible)
        self.assertIn("rastro de excepción", corrida.motivo_ilegible or "")
        self.assertEqual(corrida.clasificacion, DESCONOCIDO)
        self.assertIn(corrida, localizar.fallidas(corridas))

    def test_result_ausente_es_desconocida_y_candidata(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result=None)

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertFalse(corrida.tiene_result)
        self.assertIsNone(corrida.passed)
        self.assertEqual(corrida.motivo_ilegible, "no existe")
        self.assertEqual(corrida.clasificacion, DESCONOCIDO)
        self.assertIn(corrida, localizar.fallidas(corridas))

    def test_pass_falso_es_candidata(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(
            runs,
            "20260814T081136",
            result={
                "pass": False,
                "status": "DATA_GATES_FAILED",
                "label": "10m",
                "capture_session_id": "d64fea5560ac489eac0b5666111cc0cf",
            },
        )

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertIs(corrida.passed, False)
        self.assertEqual(corrida.status, "DATA_GATES_FAILED")
        self.assertEqual(corrida.label, "10m")
        self.assertEqual(corrida.capture_session_id, "d64fea5560ac489eac0b5666111cc0cf")
        self.assertIsNone(corrida.motivo_ilegible)
        self.assertEqual(corrida.clasificacion, FAIL)
        self.assertEqual([c.nombre for c in localizar.fallidas(corridas)], [corrida.nombre])

    def test_pass_verdadero_con_status_completed_no_es_candidata(self) -> None:
        # "COMPLETED" es el ÚNICO status que el motor escribe cuando la etapa se
        # cerró entera (launcher.py:2562-2563). Si esta prueba usara un status
        # inventado, aprobaría un módulo que marca como FALLO todas las corridas
        # sanas de verdad, que es exactamente lo que pasaba antes.
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(
            runs, "20260814T081136", result={"pass": True, "status": "COMPLETED"}
        )

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertIs(corrida.passed, True)
        self.assertEqual(corrida.status, "COMPLETED")
        self.assertEqual(corrida.clasificacion, PASS)
        self.assertFalse(corrida.es_fallida)
        self.assertEqual(localizar.fallidas(corridas), [])

    def test_el_estado_sano_es_el_que_escribe_el_motor_y_no_otro(self) -> None:
        # Guarda contra la regresión que ya ocurrió: poner aquí el veredicto
        # "PASS" del proyecto, que el motor NUNCA escribe en RESULT.json.
        self.assertEqual(localizar.ESTADO_SANO, "COMPLETED")
        self.assertEqual(localizar.ESTADOS_SANOS, ("COMPLETED",))
        self.assertNotIn("PASS", localizar.ESTADOS_SANOS)
        self.assertNotIn("OK", localizar.ESTADOS_SANOS)

    def test_los_status_reales_de_fallo_del_motor_son_candidatos(self) -> None:
        # Los cuatro status que launcher.py puede escribir; tres son candidatos.
        runs = _crear_runs(self.base, "JF")
        esperado = {
            "DATA_GATES_FAILED": FAIL,
            "PENDING_CLOCK_POSTFLIGHT": FAIL,
            "CLOCK_POSTFLIGHT_FAILED": FAIL,
            "COMPLETED": PASS,
        }
        for indice, (status, clasificacion) in enumerate(esperado.items()):
            _crear_corrida(
                runs,
                f"2026081{indice}T081136",
                sufijo=f"10m_{indice:012d}",
                result={"pass": status == "COMPLETED", "status": status},
            )

        por_status = {c.status: c for c in localizar.inventariar(self.base)}
        self.assertEqual(set(por_status), set(esperado))
        for status, clasificacion in esperado.items():
            with self.subTest(status=status):
                self.assertEqual(por_status[status].clasificacion, clasificacion)
                self.assertEqual(por_status[status].es_fallida, clasificacion != PASS)

    def test_status_desconocido_para_el_motor_no_se_da_por_sano(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": True, "status": "PASS"})

        corridas = localizar.inventariar(self.base)
        self.assertEqual(corridas[0].clasificacion, FAIL)
        self.assertEqual(len(localizar.fallidas(corridas)), 1)

    def test_pass_verdadero_sin_status_es_desconocida_y_candidata(self) -> None:
        # El motor escribe siempre «pass» y «status» juntos: un «pass: true»
        # huérfano no es evidencia del motor y no puede declararse sano.
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": True})

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertIsNone(corrida.passed)
        self.assertIn("status", corrida.motivo_ilegible or "")
        self.assertEqual(corrida.clasificacion, DESCONOCIDO)
        self.assertIn(corrida, localizar.fallidas(corridas))

    def test_pass_falso_sin_status_conserva_el_fallo_declarado(self) -> None:
        # Simétrico del anterior: un fallo declarado se respeta tal cual, sin
        # degradarlo a DESCONOCIDA, porque no falta nada por saber.
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        corrida = localizar.inventariar(self.base)[0]
        self.assertIs(corrida.passed, False)
        self.assertIsNone(corrida.motivo_ilegible)
        self.assertEqual(corrida.clasificacion, FAIL)

    def test_pass_verdadero_con_status_de_fallo_si_es_candidata(self) -> None:
        # Un status terminal que no es sano manda sobre el booleano: si ambos se
        # contradicen, la corrida no se da por buena.
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(
            runs, "20260814T081136", result={"pass": True, "status": "CLOCK_POSTFLIGHT_FAILED"}
        )

        corridas = localizar.inventariar(self.base)
        self.assertEqual(corridas[0].clasificacion, FAIL)
        self.assertEqual(len(localizar.fallidas(corridas)), 1)

    def test_pass_no_booleano_no_se_da_por_sano(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": "true", "status": "PASS"})

        corridas = localizar.inventariar(self.base)
        corrida = corridas[0]
        self.assertIsNone(corrida.passed)
        self.assertIsNotNone(corrida.motivo_ilegible)
        self.assertEqual(corrida.clasificacion, DESCONOCIDO)
        self.assertIn(corrida, localizar.fallidas(corridas))

    def test_capture_session_id_anidado_en_ready(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(
            runs,
            "20260814T081136",
            result={"pass": False, "ready": {"capture_session_id": "abcdef0123456789"}},
        )

        corrida = localizar.inventariar(self.base)[0]
        self.assertEqual(corrida.capture_session_id, "abcdef0123456789")

    def test_invariante_passed_none_implica_motivo(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081100", sufijo="10m_aaaaaaaaaaaa", result=None)
        _crear_corrida(runs, "20260814T081200", sufijo="10m_bbbbbbbbbbbb", result="{no es json")
        _crear_corrida(runs, "20260814T081300", sufijo="10m_cccccccccccc", result={"pass": True})

        for corrida in localizar.inventariar(self.base):
            self.assertEqual(
                corrida.passed is None,
                corrida.motivo_ilegible is not None,
                msg=f"invariante rota en {corrida.nombre}",
            )


class PruebasArchivosClave(BaseTemporal):
    def test_detecta_presencia_completa(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T081121")
        _crear_corrida(
            runs,
            "20260814T081136",
            result={"pass": False, "status": "DATA_GATES_FAILED"},
            postflight=True,
            metrics=True,
            audit=True,
        )

        corrida = localizar.inventariar(self.base)[0]
        self.assertEqual(
            corrida.archivos_clave,
            {
                "RESULT.json": True,
                "clock_preflight.json": True,
                "clock_postflight.json": True,
                "jean_flow_metrics.jsonl": True,
                "audit_*.json": True,
            },
        )
        self.assertEqual(corrida.archivos_faltantes, [])

    def test_detecta_ausencias(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T081121", con_clock=False)
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        corrida = localizar.inventariar(self.base)[0]
        self.assertEqual(
            corrida.archivos_clave,
            {
                "RESULT.json": True,
                "clock_preflight.json": False,
                "clock_postflight.json": False,
                "jean_flow_metrics.jsonl": False,
                "audit_*.json": False,
            },
        )
        self.assertEqual(
            corrida.archivos_faltantes,
            [
                "clock_preflight.json",
                "clock_postflight.json",
                "jean_flow_metrics.jsonl",
                "audit_*.json",
            ],
        )

    def test_audit_reconoce_cualquier_nombre_del_patron(self) -> None:
        runs = _crear_runs(self.base, "JF")
        carpeta = _crear_corrida(runs, "20260814T081136", result={"pass": False})
        capture = carpeta / "capture"
        capture.mkdir()
        (capture / "audit_usdm_futures_replay_2.json").write_text("{}", encoding="utf-8")

        corrida = localizar.inventariar(self.base)[0]
        self.assertTrue(corrida.archivos_clave["audit_*.json"])


class PruebasInventario(BaseTemporal):
    def test_dos_instalaciones_devuelven_corridas_de_ambas(self) -> None:
        runs_a = _crear_runs(self.base, "JF")
        runs_b = _crear_runs(self.base, "JF_VIEJO")
        _crear_preflight(runs_a, "20260814T081121")
        _crear_preflight(runs_b, "20260810T100000")
        _crear_corrida(runs_a, "20260814T081136", sufijo="10m_d64fea5560ac", result={"pass": False})
        _crear_corrida(runs_b, "20260810T100500", sufijo="10m_eeeeeeeeeeee", result={"pass": True})

        corridas = localizar.inventariar(self.base)
        self.assertEqual(len(corridas), 2)
        instalaciones = {corrida.instalacion for corrida in corridas}
        self.assertEqual(instalaciones, {self.base / "JF", self.base / "JF_VIEJO"})
        # El orden es por marca, de modo que el inventario es reproducible.
        self.assertEqual([c.marca for c in corridas], ["20260810T100500", "20260814T081136"])

    def test_los_preflights_no_se_inventarian_como_corridas(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T081121")
        _crear_corrida(runs, "20260814T081136", result={"pass": True})

        corridas = localizar.inventariar(self.base)
        self.assertEqual(len(corridas), 1)
        self.assertFalse(corridas[0].nombre.startswith("preflight_"))

    def test_carpeta_renombrada_con_result_se_inventaria_con_marca_none(self) -> None:
        runs = _crear_runs(self.base, "JF")
        carpeta = runs / "copia_de_la_corrida_que_fallo"
        carpeta.mkdir()
        (carpeta / "RESULT.json").write_text(json.dumps({"pass": False}), encoding="utf-8")

        corridas = localizar.inventariar(self.base)
        self.assertEqual(len(corridas), 1)
        self.assertIsNone(corridas[0].marca)
        self.assertIsNone(corridas[0].preflight)
        self.assertIn(corridas[0], localizar.fallidas(corridas))

    def test_carpeta_ajena_sin_result_se_ignora(self) -> None:
        runs = _crear_runs(self.base, "JF")
        (runs / "_archivo_temporal").mkdir()
        _crear_corrida(runs, "20260814T081136", result={"pass": True})

        self.assertEqual(len(localizar.inventariar(self.base)), 1)

    def test_runs_fuera_del_proyecto_no_cuenta(self) -> None:
        # ``buscar_carpetas_runs`` exige que el padre sea binance_phase1_collector.
        ajena = self.base / "otro_programa" / "runs"
        ajena.mkdir(parents=True)
        (ajena / "20260814T081136_123456Z_10m_aaaaaaaaaaaa").mkdir()

        self.assertEqual(localizar.inventariar(self.base), [])

    def test_raiz_inexistente_devuelve_lista_vacia(self) -> None:
        self.assertEqual(localizar.inventariar(self.base / "no_existe"), [])


class PruebasInformes(BaseTemporal):
    def _arbol_mixto(self) -> list[localizar.Corrida]:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T081121")
        _crear_corrida(
            runs,
            "20260814T081136",
            sufijo="10m_d64fea5560ac",
            result={
                "pass": False,
                "status": "DATA_GATES_FAILED",
                "label": "10m",
                "capture_session_id": "d64fea5560ac489eac0b5666111cc0cf",
            },
            metrics=True,
            audit=True,
        )
        _crear_corrida(
            runs, "20260814T083000", sufijo="10m_ffffffffffff", result=TRACEBACK_FALSO
        )
        _crear_corrida(
            runs,
            "20260814T084000",
            sufijo="10m_999999999999",
            result={"pass": True, "status": "COMPLETED"},
            postflight=True,
            metrics=True,
            audit=True,
        )
        return localizar.inventariar(self.base)

    def test_informe_texto_nombra_las_candidatas_y_lo_que_les_falta(self) -> None:
        corridas = self._arbol_mixto()
        texto = localizar.informe_texto(corridas)

        self.assertIn("CANDIDATAS A «LA SESIÓN QUE FALLÓ»", texto)
        self.assertIn("DESCONOCIDA", texto)
        self.assertIn("20260814T081136_123456Z_10m_d64fea5560ac", texto)
        self.assertIn("20260814T083000_123456Z_10m_ffffffffffff", texto)
        # La sana no debe aparecer en la sección de candidatas.
        seccion = texto.split("CANDIDATAS A")[1]
        self.assertNotIn("999999999999", seccion)
        # Y se dice exactamente qué archivo falta.
        self.assertIn("clock_postflight.json", seccion)

    def test_informe_texto_es_representable_en_cp1252(self) -> None:
        # La consola de Windows en español es cp1252 y ya tumbó una sesión
        # entera por un carácter que no sabía escribir. El informe no repite eso.
        texto = localizar.informe_texto(self._arbol_mixto())
        texto.encode("cp1252")

    def test_informe_texto_sin_corridas_no_finge_nada(self) -> None:
        texto = localizar.informe_texto([])
        self.assertIn("No se encontró ninguna corrida", texto)

    def test_informe_json_es_serializable_y_cuadra_con_las_candidatas(self) -> None:
        corridas = self._arbol_mixto()
        informe = localizar.informe_json(corridas)

        json.dumps(informe, ensure_ascii=False)  # no debe lanzar
        self.assertEqual(informe["totales"]["corridas"], 3)
        self.assertEqual(informe["totales"]["candidatas"], 2)
        self.assertEqual(informe["totales"]["sanas"], 1)
        self.assertEqual(informe["totales"]["desconocidas"], 1)
        self.assertEqual(informe["totales"]["con_fallo_declarado"], 1)
        self.assertEqual(
            informe["candidatas"], [c.nombre for c in localizar.fallidas(corridas)]
        )
        self.assertEqual(informe["archivos_pedidos"], list(localizar.ARCHIVOS_CLAVE))

    def test_informe_json_es_reproducible(self) -> None:
        corridas = self._arbol_mixto()
        primero = json.dumps(localizar.informe_json(corridas), sort_keys=True)
        segundo = json.dumps(localizar.informe_json(localizar.inventariar(self.base)), sort_keys=True)
        self.assertEqual(primero, segundo)


class PruebasCarpetaIlegible(BaseTemporal):
    """Una carpeta que no se puede listar no puede desaparecer en silencio.

    El fallo se simula sustituyendo ``Path.iterdir`` SOLO para esa carpeta, en
    vez de con permisos del sistema: así la prueba da el mismo resultado en
    Windows y en Linux, y no depende de con qué usuario se ejecute.
    """

    def _sin_permiso_en(self, prohibida: Path):
        real = Path.iterdir

        def falso(self_ruta: Path):
            if self_ruta == prohibida:
                raise PermissionError(13, "Permiso denegado")
            return real(self_ruta)

        return mock.patch.object(Path, "iterdir", falso)

    def test_carpeta_runs_ilegible_se_declara_con_su_motivo(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        with self._sin_permiso_en(runs):
            corridas, incidencias = localizar.inventariar_con_incidencias(self.base)

        self.assertEqual(corridas, [])
        self.assertTrue(incidencias, "la carpeta ilegible tiene que dejar rastro")
        self.assertIn(str(runs), incidencias.texto())
        self.assertIn("Permiso denegado", incidencias.texto())

    def test_el_informe_avisa_de_que_no_se_pudo_mirar(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        with self._sin_permiso_en(runs):
            corridas, incidencias = localizar.inventariar_con_incidencias(self.base)
        texto = localizar.informe_texto(corridas, incidencias)

        self.assertIn("CARPETAS QUE NO SE PUDIERON MIRAR", texto)
        self.assertIn("NO quiere decir «no había»", texto)
        texto.encode("cp1252")

    def test_el_informe_json_publica_las_carpetas_no_legibles(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        with self._sin_permiso_en(runs):
            corridas, incidencias = localizar.inventariar_con_incidencias(self.base)
        informe = localizar.informe_json(corridas, incidencias)

        self.assertEqual(len(informe["carpetas_no_legibles"]), 1)
        self.assertIn(str(runs), informe["carpetas_no_legibles"][0])
        json.dumps(informe, ensure_ascii=False)

    def test_sin_incidencias_el_informe_no_inventa_el_bloque(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_corrida(runs, "20260814T081136", result={"pass": False})

        corridas, incidencias = localizar.inventariar_con_incidencias(self.base)
        self.assertFalse(incidencias)
        self.assertNotIn(
            "CARPETAS QUE NO SE PUDIERON MIRAR",
            localizar.informe_texto(corridas, incidencias),
        )
        self.assertEqual(
            localizar.informe_json(corridas, incidencias)["carpetas_no_legibles"], []
        )

    def test_una_carpeta_ilegible_no_tumba_el_inventario_de_las_demas(self) -> None:
        runs_a = _crear_runs(self.base, "JF")
        runs_b = _crear_runs(self.base, "JF_VIEJO")
        _crear_corrida(runs_a, "20260814T081136", result={"pass": False})
        _crear_corrida(runs_b, "20260810T100500", result={"pass": False})

        with self._sin_permiso_en(runs_a):
            corridas, incidencias = localizar.inventariar_con_incidencias(self.base)

        self.assertEqual([c.marca for c in corridas], ["20260810T100500"])
        self.assertTrue(incidencias)


class PruebasSoloLectura(BaseTemporal):
    """La regla número uno: nada de lo que hay aquí escribe dentro de runs/."""

    def test_inventariar_no_escribe_nada_en_el_arbol(self) -> None:
        runs = _crear_runs(self.base, "JF")
        _crear_preflight(runs, "20260814T081121")
        _crear_corrida(
            runs,
            "20260814T081136",
            sufijo="10m_d64fea5560ac",
            result={"pass": False, "status": "DATA_GATES_FAILED"},
            postflight=True,
            metrics=True,
            audit=True,
        )
        _crear_corrida(runs, "20260814T083000", sufijo="10m_ffffffffffff", result=TRACEBACK_FALSO)

        antes = _instantanea(self.base)
        corridas = localizar.inventariar(self.base)
        localizar.informe_texto(corridas)
        localizar.informe_json(corridas)
        localizar.fallidas(corridas)
        despues = _instantanea(self.base)

        self.assertEqual(antes, despues)
        self.assertTrue(antes, "el árbol de prueba no puede estar vacío")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
