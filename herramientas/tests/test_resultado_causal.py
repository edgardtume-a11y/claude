"""Pruebas de ``jf_evidencia.resultado_causal``.

Todas construyen su propia corrida falsa con ``tempfile``. Ninguna depende de la
evidencia de campo, de la red ni del reloj real: ``ahora_ns`` se pasa fijo.

Las pruebas que más importan aquí no son las del veredicto, sino las que fijan
las prohibiciones: que el ``RESULT.json`` de entrada queda byte a byte igual,
que ``CAPTURA_COMPLETA_AUDITADA.json`` no se crea ni se nombra, y que el
artefacto NO contiene ningún booleano agregado. El booleano agregado es el
defecto que este artefacto corrige; si volviera a colarse, ninguna prueba de
veredicto lo notaría.
"""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from jf_evidencia import resultado_causal
from jf_evidencia.comun import DESCONOCIDO, FAIL, PASS

AHORA_NS = 1786695779206452600

# El fallo real de campo: el informe de métricas de la sesión d64fea5560ac no
# es un informe, es un rastro de excepción de Python.
TRACEBACK_FALSO = (
    "Traceback (most recent call last):\n"
    '  File "C:\\JF\\555\\binance_phase1_collector\\src\\binance_collector\\audit.py",'
    " line 1180, in main\n"
    "    print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))\n"
    "UnicodeEncodeError: 'charmap' codec can't encode characters in position 538-539:"
    " character maps to <undefined>\n"
)

CAMPOS_EXIGIDOS = (
    "schema_version",
    "policy",
    "capture_session_id",
    "causal_integrity",
    "causal_integrity_reason",
    "monotonic_performance",
    "monotonic_performance_reason",
    "utc_quality",
    "utc_quality_reason",
    "inputs_sha256",
    "result_json_sha256",
    "emitted_utc_ns",
    "engine_version",
)

MERCADOS = ("spot", "usdm_futures")


def _result_bueno() -> dict[str, Any]:
    """Un ``RESULT.json`` con la forma real del motor y todo en orden.

    ``pass`` es ``false`` y el estado es ``PENDING_CLOCK_POSTFLIGHT`` a
    propósito: así lo escribe el lanzador antes del postflight de reloj
    (launcher.py:1991-1996). Una corrida causalmente íntegra llega a este
    archivo con ``pass=false``, y por eso la integridad causal NO puede
    derivarse del booleano agregado.
    """

    return {
        "pass": False,
        "status": "PENDING_CLOCK_POSTFLIGHT",
        "data_gates_pass": True,
        "label": "10m",
        "capture_session_id": "d64fea5560ac489eac0b5666111cc0cf",
        "engine_exit_code": 0,
        "interrupted": False,
        "ready": {"engine_version": "2.4.1"},
        "session_manifest_validation": {"pass": True, "error_code": None, "message": None},
        "audit": {
            "pass": True,
            "checks": {
                "spot": True,
                "usdm_futures": True,
                "identity": True,
                "metrics": True,
                "capture_commitment": True,
            },
            "replay_determinism": {
                mercado: {
                    "error": None,
                    "final_state_identical": True,
                    "first_sha256": "a" * 64,
                    "second_sha256": "a" * 64,
                    "pass": True,
                }
                for mercado in MERCADOS
            },
            "capture_commitment": {
                "checked_files": 2,
                "errors": [],
                "last_ingest_seq": 38612,
                "pass": True,
            },
            "partial_files": [],
            "completed_utc_ns": 1786695779202827300,
        },
        "run_root": "C:\\JF\\555\\binance_phase1_collector\\runs\\corrida",
        "completed_utc_ns": 1786695779206452600,
    }


def _umbral(limite_ms: float, valor_ms: float, *, muestras: int = 5000) -> dict[str, Any]:
    return {
        "required": True,
        "present": True,
        "latest_value_ms": valor_ms,
        "worst_value_ms": valor_ms,
        "worst_value_ms_incl_warmup": valor_ms,
        "limit_ms": limite_ms,
        "sample_count": muestras,
        "min_samples": 100,
        "basis": "worst_p99",
        "clock_domain": "monotonic",
        "pass": valor_ms <= limite_ms,
    }


def _informe_metricas(**ajustes: dict[str, Any]) -> dict[str, Any]:
    """Informe de métricas con la forma real de ``audit_metrics.json``.

    Por omisión todas las métricas van holgadamente por debajo de su límite.
    ``ajustes`` reemplaza la entrada de un gate concreto en todos los mercados.
    """

    mercados: dict[str, Any] = {}
    for mercado in MERCADOS:
        umbrales = {
            gate: _umbral(limite, limite / 10.0)
            for gate, (_metrica, limite) in resultado_causal.UMBRALES_P99_MS.items()
        }
        umbrales.update(ajustes)
        mercados[mercado] = {
            "status": "PASS",
            "windows": 120,
            "thresholds": umbrales,
            "metric_errors": [],
        }
    return {
        "certification": "PASS",
        "malformed_json_lines": 0,
        "required_markets": sorted(MERCADOS),
        "missing_markets": [],
        "markets": mercados,
        "clock_domains": {
            "monotonic": [metrica for metrica, _l in resultado_causal.UMBRALES_P99_MS.values()],
            "cross_clock": [
                "exchange_to_receive_depth",
                "exchange_to_receive_trade",
                "trade_time_to_receive",
            ],
        },
    }


def _crear_corrida(
    base: Path,
    *,
    result: Any = "POR_OMISION",
    metricas: Any = "POR_OMISION",
) -> Path:
    """Crea una corrida falsa. ``None`` omite el archivo; una cadena se escribe tal cual."""

    run_dir = base / "20260814T081136_503806Z_10m_d64fea5560ac"
    (run_dir / "capture").mkdir(parents=True, exist_ok=True)

    if result == "POR_OMISION":
        result = _result_bueno()
    if result is not None:
        texto = result if isinstance(result, str) else json.dumps(result, sort_keys=True)
        (run_dir / "RESULT.json").write_text(texto, encoding="utf-8")

    if metricas == "POR_OMISION":
        metricas = _informe_metricas()
    if metricas is not None:
        texto = metricas if isinstance(metricas, str) else json.dumps(metricas, sort_keys=True)
        (run_dir / "capture" / "audit_metrics.json").write_text(texto, encoding="utf-8")

    return run_dir


def _sha256(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def _booleanos(valor: Any, camino: str = "") -> list[str]:
    """Devuelve el camino de todo booleano que haya en la estructura."""

    encontrados: list[str] = []
    if isinstance(valor, bool):
        encontrados.append(camino or "<raíz>")
    elif isinstance(valor, dict):
        for clave, hijo in valor.items():
            encontrados.extend(_booleanos(hijo, f"{camino}.{clave}" if camino else str(clave)))
    elif isinstance(valor, list):
        for indice, hijo in enumerate(valor):
            encontrados.extend(_booleanos(hijo, f"{camino}[{indice}]"))
    return encontrados


class BaseCorrida(unittest.TestCase):
    """Cada prueba trabaja sobre su propio directorio temporal."""

    def setUp(self) -> None:
        self._temporal = tempfile.TemporaryDirectory()
        self.addCleanup(self._temporal.cleanup)
        self.base = Path(self._temporal.name)


class PruebasEmision(BaseCorrida):
    def test_emision_correcta_publica_los_trece_campos(self) -> None:
        run_dir = _crear_corrida(self.base)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNotNone(ruta)
        self.assertEqual(motivo, "")
        assert ruta is not None
        self.assertEqual(ruta.name, "RESULTADO_CAUSAL.json")
        self.assertEqual(ruta.parent, run_dir)

        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(sorted(artefacto), sorted(CAMPOS_EXIGIDOS))
        self.assertEqual(artefacto["schema_version"], "1.0.0")
        self.assertEqual(artefacto["policy"], "causal-v1")
        self.assertEqual(artefacto["schema_version"], resultado_causal.ESQUEMA)
        self.assertEqual(artefacto["policy"], resultado_causal.POLITICA)
        self.assertEqual(artefacto["capture_session_id"], "d64fea5560ac489eac0b5666111cc0cf")
        self.assertEqual(artefacto["causal_integrity"], PASS)
        self.assertEqual(artefacto["causal_integrity_reason"], "")
        self.assertEqual(artefacto["monotonic_performance"], PASS)
        self.assertEqual(artefacto["utc_quality"], DESCONOCIDO)
        self.assertEqual(artefacto["emitted_utc_ns"], AHORA_NS)
        self.assertEqual(artefacto["engine_version"], "2.4.1")
        self.assertEqual(
            artefacto["result_json_sha256"], _sha256(run_dir / "RESULT.json")
        )
        self.assertEqual(
            artefacto["inputs_sha256"],
            {
                "RESULT.json": _sha256(run_dir / "RESULT.json"),
                "capture/audit_metrics.json": _sha256(
                    run_dir / "capture" / "audit_metrics.json"
                ),
            },
        )

    def test_capture_session_id_se_copia_no_se_recalcula(self) -> None:
        # Un identificador que no se parece en nada al nombre de la carpeta:
        # si se copiara del nombre, esta prueba lo delataría.
        result = _result_bueno()
        result["capture_session_id"] = "IDENTIDAD_DECLARADA_POR_EL_MOTOR"
        run_dir = _crear_corrida(self.base, result=result)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(artefacto["capture_session_id"], "IDENTIDAD_DECLARADA_POR_EL_MOTOR")

    def test_no_se_emite_si_falta_result_json(self) -> None:
        run_dir = _crear_corrida(self.base, result=None)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNone(ruta)
        self.assertIn("RESULT.json", motivo)
        self.assertIn("no existe", motivo)
        self.assertFalse((run_dir / "RESULTADO_CAUSAL.json").exists())

    def test_no_se_emite_si_result_json_es_ilegible(self) -> None:
        run_dir = _crear_corrida(self.base, result=TRACEBACK_FALSO)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNone(ruta)
        self.assertIn("RESULT.json", motivo)
        self.assertIn("rastro de excepción", motivo)
        self.assertFalse((run_dir / "RESULTADO_CAUSAL.json").exists())

    def test_no_se_emite_sin_capture_session_id(self) -> None:
        result = _result_bueno()
        del result["capture_session_id"]
        run_dir = _crear_corrida(self.base, result=result)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNone(ruta)
        self.assertIn("capture_session_id", motivo)
        self.assertFalse((run_dir / "RESULTADO_CAUSAL.json").exists())

    def test_engine_version_es_null_si_no_se_pudo_determinar(self) -> None:
        result = _result_bueno()
        result["ready"] = {}
        run_dir = _crear_corrida(self.base, result=result)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertIsNone(artefacto["engine_version"])

    def test_se_emite_aunque_falte_el_informe_de_metricas(self) -> None:
        # El informe de métricas no es obligatorio para emitir: si no está, su
        # veredicto es UNKNOWN con motivo y no entra en inputs_sha256.
        run_dir = _crear_corrida(self.base, metricas=None)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNotNone(ruta)
        self.assertEqual(motivo, "")
        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(list(artefacto["inputs_sha256"]), ["RESULT.json"])
        self.assertEqual(artefacto["monotonic_performance"], DESCONOCIDO)
        self.assertIn("no existe", artefacto["monotonic_performance_reason"])

    def test_el_informe_ilegible_se_sella_igual_y_entra_en_inputs(self) -> None:
        # El caso exacto de campo: el archivo ESTÁ y sus bytes se leen, pero su
        # contenido es un rastro de excepción. El artefacto se emite, y el sello
        # es el de los bytes que hay, no el de un informe que nunca existió: sin
        # ese sello nadie podría citar después qué se leyó exactamente.
        run_dir = _crear_corrida(self.base, metricas=TRACEBACK_FALSO)

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertEqual(motivo, "")
        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(
            artefacto["inputs_sha256"]["capture/audit_metrics.json"],
            _sha256(run_dir / "capture" / "audit_metrics.json"),
        )
        self.assertEqual(artefacto["monotonic_performance"], DESCONOCIDO)

    def test_un_fail_causal_llega_al_artefacto_con_su_motivo(self) -> None:
        # Reproduce la sesión real: identidad en false y replay roto por la
        # codificación. Jean tiene que poder leer POR QUÉ en el propio
        # artefacto, sin abrir el RESULT.json ni saber qué es un JSON.
        result = _result_bueno()
        result["audit"]["checks"]["identity"] = False
        result["audit"]["checks"]["spot"] = False
        result["audit"]["replay_determinism"]["spot"]["pass"] = False
        result["audit"]["replay_determinism"]["spot"]["error"] = (
            "RuntimeContractError: 'utf-8' codec can't decode byte 0xe9 in position 700"
        )
        run_dir = _crear_corrida(self.base, result=result)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(artefacto["causal_integrity"], FAIL)
        razon = artefacto["causal_integrity_reason"]
        self.assertIn("identity", razon)
        self.assertIn("replay_determinism.spot", razon)
        self.assertIsInstance(razon, str)

    def test_no_se_emite_si_el_informe_de_metricas_esta_pero_no_se_puede_sellar(self) -> None:
        # Hay ALGO en la ruta del informe y no se puede sellar. Emitir sin ese
        # sello publicaría un artefacto que no se puede verificar después, así
        # que no se emite y se dice por qué.
        run_dir = _crear_corrida(self.base, metricas=None)
        (run_dir / "capture" / "audit_metrics.json").mkdir()

        ruta, motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNone(ruta)
        self.assertIn("capture/audit_metrics.json", motivo)
        self.assertIn("no es un archivo", motivo)
        self.assertFalse((run_dir / "RESULTADO_CAUSAL.json").exists())

    def test_construir_rechaza_un_ahora_ns_que_no_es_entero(self) -> None:
        # Un flotante o un booleano aquí produciría un ``emitted_utc_ns`` que
        # no es el momento de emisión, y el artefacto quedaría mintiendo.
        run_dir = _crear_corrida(self.base)
        veredictos, _motivo = resultado_causal.evaluar(run_dir)
        assert veredictos is not None

        for malo in (1.5, True, "1786695779206452600", None):
            with self.subTest(ahora_ns=malo):
                with self.assertRaises(ValueError):
                    resultado_causal.construir(run_dir, veredictos, ahora_ns=malo)  # type: ignore[arg-type]


class PruebasProhibiciones(BaseCorrida):
    def test_result_json_de_entrada_queda_intacto(self) -> None:
        run_dir = _crear_corrida(self.base)
        ruta_result = run_dir / "RESULT.json"
        antes = _sha256(ruta_result)
        mtime_antes = ruta_result.stat().st_mtime_ns

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNotNone(ruta)
        self.assertTrue(ruta_result.is_file())
        self.assertEqual(_sha256(ruta_result), antes)
        self.assertEqual(ruta_result.stat().st_mtime_ns, mtime_antes)

    def test_no_se_crea_ni_se_nombra_captura_completa_auditada(self) -> None:
        run_dir = _crear_corrida(self.base)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNotNone(ruta)
        assert ruta is not None
        for carpeta in (run_dir, run_dir.parent, run_dir / "capture"):
            self.assertFalse((carpeta / "CAPTURA_COMPLETA_AUDITADA.json").exists())
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertNotIn("CAPTURA_COMPLETA_AUDITADA.json", artefacto["inputs_sha256"])

        # No basta con que no exista: el módulo no debe ni consultarlo. La
        # única forma de leerlo sería nombrarlo, así que se comprueba que su
        # nombre no aparece en el código fuente salvo en la lista de nombres
        # que la herramienta se niega a escribir.
        fuente = Path(resultado_causal.__file__).read_text(encoding="utf-8")
        apariciones = fuente.count("CAPTURA_COMPLETA_AUDITADA")
        self.assertLessEqual(apariciones, 2, "el módulo no debe manipular ese archivo")

    def test_no_hay_ningun_booleano_agregado_en_el_artefacto(self) -> None:
        run_dir = _crear_corrida(self.base)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        assert ruta is not None
        artefacto = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(
            _booleanos(artefacto),
            [],
            "el artefacto no puede llevar ningún booleano: el booleano agregado "
            "es el defecto que se está corrigiendo",
        )
        for campo in ("causal_integrity", "monotonic_performance", "utc_quality"):
            self.assertIsInstance(artefacto[campo], str)
            self.assertIn(artefacto[campo], (PASS, FAIL, DESCONOCIDO))
        # Ningún campo de resumen global, con ninguno de sus nombres probables.
        for prohibido in ("pass", "ok", "overall", "summary", "result", "verdict", "all_pass"):
            self.assertNotIn(prohibido, artefacto)

    def test_los_cinco_umbrales_no_se_mueven(self) -> None:
        self.assertEqual(
            resultado_causal.UMBRALES_P99_MS,
            {
                "parse_p99": ("parse", 5.0),
                "book_apply_p99": ("book_apply", 5.0),
                "book_pipeline_p99": ("book_pipeline_total", 5.0),
                "event_loop_lag_p99": ("event_loop_lag", 40.0),
                "writer_yield_p99": ("writer_cooperative_yield", 5.0),
            },
        )

    def test_se_niega_a_escribir_sobre_evidencia_intocable(self) -> None:
        run_dir = _crear_corrida(self.base)
        antes = _sha256(run_dir / "RESULT.json")

        ruta, motivo = resultado_causal.emitir(
            run_dir, ahora_ns=AHORA_NS, destino=run_dir / "RESULT.json"
        )

        self.assertIsNone(ruta)
        self.assertIn("intocable", motivo)
        self.assertEqual(_sha256(run_dir / "RESULT.json"), antes)

    def test_se_niega_a_escribir_con_el_nombre_del_marcador_de_captura(self) -> None:
        # Ni siquiera pidiéndoselo por parámetro: ese marcador tiene un
        # significado propio y esta herramienta no está en posición de crearlo.
        run_dir = _crear_corrida(self.base)

        ruta, motivo = resultado_causal.emitir(
            run_dir,
            ahora_ns=AHORA_NS,
            destino=run_dir / "CAPTURA_COMPLETA_AUDITADA.json",
        )

        self.assertIsNone(ruta)
        self.assertIn("intocable", motivo)
        self.assertFalse((run_dir / "CAPTURA_COMPLETA_AUDITADA.json").exists())

    def test_escritura_atomica_no_deja_temporales(self) -> None:
        run_dir = _crear_corrida(self.base)

        ruta, _motivo = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertIsNotNone(ruta)
        sobrantes = [
            hijo.name
            for hijo in run_dir.iterdir()
            if hijo.name.endswith(".tmp") or hijo.name.startswith(".RESULTADO_CAUSAL")
        ]
        self.assertEqual(sobrantes, [])
        self.assertEqual(
            sorted(hijo.name for hijo in run_dir.iterdir()),
            ["RESULT.json", "RESULTADO_CAUSAL.json", "capture"],
        )


class PruebasIntegridadCausal(BaseCorrida):
    def _completo(self, result: Any) -> tuple[str, str]:
        base = Path(tempfile.mkdtemp(dir=self.base))
        run_dir = _crear_corrida(base, result=result)
        veredictos, motivo = resultado_causal.evaluar(run_dir)
        self.assertIsNotNone(veredictos, motivo)
        assert veredictos is not None
        return veredictos.causal_integrity, veredictos.causal_integrity_reason

    def _veredicto(self, result: Any) -> str:
        estado, motivo = self._completo(result)
        if estado != PASS:
            # Un FAIL mudo obliga a leer JSON para saber qué pasó, y quien lee
            # esto no es programador. El motivo es parte del veredicto.
            self.assertTrue(motivo.strip(), "un FAIL causal tiene que declarar su motivo")
        return estado

    def test_pass_con_todo_en_orden(self) -> None:
        self.assertEqual(self._veredicto(_result_bueno()), PASS)

    def test_fail_si_el_motor_no_termino_con_codigo_cero(self) -> None:
        result = _result_bueno()
        result["engine_exit_code"] = 1
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_falta_engine_exit_code(self) -> None:
        result = _result_bueno()
        del result["engine_exit_code"]
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_engine_exit_code_es_false(self) -> None:
        # En Python ``False == 0``: sin la comprobación estricta, un campo
        # corrupto con valor booleano se leería como «terminó bien».
        result = _result_bueno()
        result["engine_exit_code"] = False
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_la_validacion_del_manifiesto_no_paso(self) -> None:
        result = _result_bueno()
        result["session_manifest_validation"] = {
            "pass": False,
            "error_code": "SESSION_FINAL_INVALID",
            "message": "estado terminal inválido",
        }
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_falta_la_validacion_del_manifiesto(self) -> None:
        result = _result_bueno()
        del result["session_manifest_validation"]
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_el_replay_no_fue_determinista(self) -> None:
        # El caso real de la sesión d64fea5560ac.
        result = _result_bueno()
        result["audit"]["checks"]["spot"] = False
        result["audit"]["replay_determinism"]["spot"] = {
            "error": (
                "RuntimeContractError: 'utf-8' codec can't decode byte 0xe9 "
                "in position 700: invalid continuation byte"
            ),
            "final_state_identical": False,
            "first_sha256": None,
            "second_sha256": None,
            "pass": False,
        }
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_solo_por_el_replay_aunque_el_check_del_mercado_diga_true(self) -> None:
        # Aísla la comprobación del replay: el check del diario sigue en true,
        # así que si el módulo no mirara replay_determinism, esto daría PASS.
        result = _result_bueno()
        result["audit"]["replay_determinism"]["usdm_futures"]["pass"] = False
        result["audit"]["replay_determinism"]["usdm_futures"]["error"] = (
            "RuntimeContractError: 'utf-8' codec can't decode byte 0xe9 in position 767"
        )
        estado, motivo = self._completo(result)
        self.assertEqual(estado, FAIL)
        self.assertIn("replay_determinism.usdm_futures", motivo)
        self.assertIn("0xe9", motivo)

    def test_fail_si_falta_el_replay_de_un_mercado(self) -> None:
        # Sin replay no se ha comprobado la reconstrucción de ese mercado, y no
        # se puede afirmar la integridad de lo que no se ha comprobado.
        result = _result_bueno()
        del result["audit"]["replay_determinism"]["spot"]
        estado, motivo = self._completo(result)
        self.assertEqual(estado, FAIL)
        self.assertIn("replay_determinism.spot", motivo)

    def test_fail_si_un_check_es_verdadero_al_estilo_python_pero_no_true(self) -> None:
        # ``1`` y ``"ok"`` son verdaderos en Python. Aquí no aprueban nada.
        for valor in (1, "ok", "PASS", [1]):
            with self.subTest(valor=valor):
                result = _result_bueno()
                result["audit"]["checks"]["identity"] = valor
                self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_el_compromiso_de_captura_declara_errores(self) -> None:
        result = _result_bueno()
        result["audit"]["capture_commitment"]["errors"] = [
            "spot/events-000001.csv: last_ingest_seq no coincide"
        ]
        estado, motivo = self._completo(result)
        self.assertEqual(estado, FAIL)
        self.assertIn("capture_commitment", motivo)

    def test_fail_si_falta_el_bloque_audit_entero(self) -> None:
        result = _result_bueno()
        del result["audit"]
        estado, motivo = self._completo(result)
        self.assertEqual(estado, FAIL)
        self.assertIn("audit", motivo)

    def test_fail_si_quedaron_archivos_parciales(self) -> None:
        result = _result_bueno()
        result["audit"]["partial_files"] = ["capture/spot/events-000001.csv.partial"]
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_la_captura_fue_interrumpida(self) -> None:
        result = _result_bueno()
        result["interrupted"] = True
        self.assertEqual(self._veredicto(result), FAIL)

    def test_fail_si_no_hay_ningun_mercado_auditado(self) -> None:
        # Sin mercados no hay nada que afirmar; afirmarlo igual sería fabricar
        # un PASS a partir de un conjunto vacío.
        result = _result_bueno()
        result["audit"]["checks"] = {
            "identity": True,
            "metrics": True,
            "capture_commitment": True,
        }
        self.assertEqual(self._veredicto(result), FAIL)

    def test_el_check_de_metricas_no_condena_la_integridad_causal(self) -> None:
        # Este es el desacople que justifica el artefacto: el informe de
        # métricas de la sesión real no se pudo escribir por un problema de
        # codificación de la consola, y eso no dice NADA sobre la causalidad.
        result = _result_bueno()
        result["audit"]["checks"]["metrics"] = False
        result["audit"]["pass"] = False
        result["data_gates_pass"] = False
        result["status"] = "DATA_GATES_FAILED"
        self.assertEqual(self._veredicto(result), PASS)


class PruebasRendimientoMonotonico(BaseCorrida):
    def _veredicto(self, metricas: Any) -> tuple[str, str]:
        run_dir = _crear_corrida(self.base, metricas=metricas)
        veredictos, motivo = resultado_causal.evaluar(run_dir)
        self.assertIsNotNone(veredictos, motivo)
        assert veredictos is not None
        return veredictos.monotonic_performance, veredictos.monotonic_performance_reason

    def test_pass_con_todas_las_metricas_bajo_su_limite(self) -> None:
        estado, motivo = self._veredicto(_informe_metricas())
        self.assertEqual(estado, PASS)
        self.assertEqual(motivo, "")

    def test_metricas_ilegibles_es_unknown_no_fail(self) -> None:
        # Caso real: audit_metrics.json con un traceback dentro. «No pude
        # mirar» no es «miré y salió mal».
        estado, motivo = self._veredicto(TRACEBACK_FALSO)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertNotEqual(estado, FAIL)
        self.assertIn("rastro de excepción", motivo)

    def test_metricas_con_json_invalido_es_unknown(self) -> None:
        estado, motivo = self._veredicto("{esto no es json")
        self.assertEqual(estado, DESCONOCIDO)
        self.assertTrue(motivo)

    def test_fail_si_una_metrica_supera_su_limite(self) -> None:
        informe = _informe_metricas(book_apply_p99=_umbral(5.0, 7.25))
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, FAIL)
        self.assertIn("book_apply", motivo)
        self.assertIn("7.25", motivo)

    def test_fail_por_event_loop_lag_solo_por_encima_de_40_ms(self) -> None:
        estado, _motivo = self._veredicto(
            _informe_metricas(event_loop_lag_p99=_umbral(40.0, 39.5))
        )
        self.assertEqual(estado, PASS)
        estado, motivo = self._veredicto(
            _informe_metricas(event_loop_lag_p99=_umbral(40.0, 41.0))
        )
        self.assertEqual(estado, FAIL)
        self.assertIn("event_loop_lag", motivo)

    def test_unknown_por_falta_de_muestras(self) -> None:
        informe = _informe_metricas(parse_p99=_umbral(5.0, 0.4, muestras=12))
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("muestras insuficientes", motivo)

    def test_unknown_si_falta_una_metrica_del_informe(self) -> None:
        informe = _informe_metricas()
        for mercado in MERCADOS:
            del informe["markets"][mercado]["thresholds"]["writer_yield_p99"]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("writer_cooperative_yield", motivo)

    def test_un_exceso_medido_manda_sobre_una_duda(self) -> None:
        informe = _informe_metricas(
            parse_p99=_umbral(5.0, 0.4, muestras=3),
            book_apply_p99=_umbral(5.0, 9.0),
        )
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, FAIL)
        self.assertIn("book_apply", motivo)

    def test_un_limite_relajado_en_el_informe_no_compra_un_pass(self) -> None:
        # El informe declara 50 ms para parse y su valor los respeta; el
        # umbral vigente sigue siendo 5 ms y es el que decide.
        informe = _informe_metricas(parse_p99=_umbral(50.0, 30.0))
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, FAIL)
        self.assertIn("5.0 ms", motivo)

    def test_una_metrica_de_reloj_cruzado_no_puede_ser_gate(self) -> None:
        entrada = _umbral(5.0, 0.4)
        entrada["clock_domain"] = "cross_clock"
        estado, motivo = self._veredicto(_informe_metricas(parse_p99=entrada))
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("cross_clock", motivo)

    def test_unknown_si_el_diario_de_metricas_tenia_lineas_mal_formadas(self) -> None:
        informe = _informe_metricas()
        informe["malformed_json_lines"] = 3
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("mal formada", motivo)

    def test_unknown_si_falta_un_mercado_exigido(self) -> None:
        informe = _informe_metricas()
        informe["missing_markets"] = ["usdm_futures"]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("usdm_futures", motivo)

    def test_unknown_si_el_informe_no_declara_missing_markets(self) -> None:
        # No declararlo no es declararlo vacío: sin ese campo no se sabe si el
        # conjunto de mercados medidos está completo, y un PASS sobre un
        # conjunto que no se sabe completo sería fabricado.
        informe = _informe_metricas()
        del informe["missing_markets"]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("missing_markets", motivo)

    def test_unknown_si_se_exige_un_mercado_del_que_no_hay_muestras(self) -> None:
        # Informe recortado: dice que no falta nada, pero la sección del
        # mercado exigido no está.
        informe = _informe_metricas()
        informe["required_markets"] = ["spot", "usdm_futures", "coinm_futures"]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("coinm_futures", motivo)

    def test_unknown_si_el_informe_declara_errores_de_metrica(self) -> None:
        # El motor usa metric_errors para decir que la base de muestras de ese
        # mercado no es de fiar (cobertura de ventana violada, resumen
        # incompleto, ventana terminal ambigua). Con la base en duda no se
        # puede afirmar un PASS, y tampoco condenar: es UNKNOWN.
        informe = _informe_metricas()
        informe["markets"]["spot"]["metric_errors"] = [
            "event_loop_lag: cobertura de ventana violada (serie decreciente)"
        ]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("cobertura de ventana violada", motivo)

    def test_unknown_si_el_informe_no_declara_metric_errors(self) -> None:
        informe = _informe_metricas()
        for mercado in MERCADOS:
            del informe["markets"][mercado]["metric_errors"]
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("metric_errors", motivo)

    def test_unknown_si_hubo_muestras_fuera_de_toda_ventana(self) -> None:
        # Si alguna muestra no fue visible en ninguna ventana emitida, el peor
        # p99 no cubre la sesión entera y no certifica lo que dice certificar.
        informe = _informe_metricas()
        informe["markets"]["spot"]["eviction_checks"] = {
            "parse_p99": {
                "metric": "parse",
                "evicted_reported": True,
                "max_evicted": 10,
                "window_snapshots": 0,
                "coverage_ok": None,
                "pass": False,
            }
        }
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, DESCONOCIDO)
        self.assertIn("fuera de toda ventana", motivo)

    def test_un_eviction_check_aprobado_no_estorba(self) -> None:
        # La comprobación anterior no puede convertirse en un UNKNOWN
        # permanente: un informe que publica sus eviction_checks en orden
        # sigue pudiendo dar PASS.
        informe = _informe_metricas()
        for mercado in MERCADOS:
            informe["markets"][mercado]["eviction_checks"] = {
                gate: {"metric": metrica, "evicted_reported": False, "pass": True}
                for gate, (metrica, _l) in resultado_causal.UMBRALES_P99_MS.items()
            }
        estado, motivo = self._veredicto(informe)
        self.assertEqual(estado, PASS, motivo)

    def test_motivo_obligatorio_cuando_no_es_pass(self) -> None:
        for metricas in (TRACEBACK_FALSO, _informe_metricas(parse_p99=_umbral(5.0, 9.0))):
            estado, motivo = self._veredicto(metricas)
            self.assertNotEqual(estado, PASS)
            self.assertTrue(motivo.strip(), "un veredicto que no es PASS exige motivo")


class PruebasCalidadUtc(BaseCorrida):
    def test_utc_quality_siempre_unknown_con_motivo(self) -> None:
        # En esta entrega el veredicto UTC NUNCA puede negar nada: el
        # certificado de UTC calificada está diseñado y documentado, sin
        # implementar (informe v3, sección 6.3).
        for metricas in ("POR_OMISION", None, TRACEBACK_FALSO):
            with self.subTest(metricas=metricas):
                base = Path(tempfile.mkdtemp(dir=self.base))
                run_dir = _crear_corrida(base, metricas=metricas)
                veredictos, _motivo = resultado_causal.evaluar(run_dir)
                assert veredictos is not None
                self.assertEqual(veredictos.utc_quality, DESCONOCIDO)
                self.assertNotEqual(veredictos.utc_quality, FAIL)
                self.assertTrue(veredictos.utc_quality_reason.strip())
                self.assertIn("6.3", veredictos.utc_quality_reason)


class PruebasDeterminismo(BaseCorrida):
    def test_construir_es_determinista_con_el_mismo_ahora_ns(self) -> None:
        run_dir = _crear_corrida(self.base)
        veredictos, _motivo = resultado_causal.evaluar(run_dir)
        assert veredictos is not None

        primero = resultado_causal.construir(run_dir, veredictos, ahora_ns=AHORA_NS)
        segundo = resultado_causal.construir(run_dir, veredictos, ahora_ns=AHORA_NS)

        self.assertEqual(primero, segundo)
        self.assertEqual(
            json.dumps(primero, sort_keys=True), json.dumps(segundo, sort_keys=True)
        )

    def test_construir_no_consulta_el_reloj_real(self) -> None:
        run_dir = _crear_corrida(self.base)
        veredictos, _motivo = resultado_causal.evaluar(run_dir)
        assert veredictos is not None

        artefacto = resultado_causal.construir(run_dir, veredictos, ahora_ns=7)

        self.assertEqual(artefacto["emitted_utc_ns"], 7)

    def test_emitir_dos_veces_deja_el_mismo_contenido(self) -> None:
        run_dir = _crear_corrida(self.base)

        primera, _m1 = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)
        assert primera is not None
        contenido = primera.read_bytes()
        segunda, _m2 = resultado_causal.emitir(run_dir, ahora_ns=AHORA_NS)

        self.assertEqual(primera, segunda)
        assert segunda is not None
        self.assertEqual(segunda.read_bytes(), contenido)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
