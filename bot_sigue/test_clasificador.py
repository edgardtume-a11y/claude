"""
Pruebas del supervisor. No necesitan Ollama: se sustituye la llamada HTTP.

    python3 -m unittest discover -s bot_sigue -v
"""

from __future__ import annotations

import json
import unittest
import urllib.error
from unittest import mock

from bot_sigue import Supervisor
from bot_sigue import clasificador, config


def respuesta(estado, mensaje="", confianza=0.9, motivo="prueba"):
    """Fabrica una respuesta de Ollama con la forma real de /api/chat."""
    return {
        "message": {
            "content": json.dumps(
                {
                    "estado": estado,
                    "confianza": confianza,
                    "motivo": motivo,
                    "mensaje": mensaje,
                },
                ensure_ascii=False,
            )
        }
    }


class Reloj:
    """Reloj controlable para probar el debounce sin esperar."""

    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t

    def avanzar(self, s):
        self.t += s


class TestClasificacion(unittest.TestCase):
    def test_cada_estado_produce_su_accion(self):
        esperado = {
            "cortado": "enviar",
            "pregunta": "enviar",
            "confirmacion": "enviar",
            "desviado": "enviar",
            "error": "enviar",
            "bucle": "enviar",
            "terminado": "parar",
        }
        for estado, accion in esperado.items():
            with self.subTest(estado=estado):
                with mock.patch.object(
                    clasificador, "_pedir_a_ollama", return_value=respuesta(estado, "x")
                ):
                    d = clasificador.clasificar(["mensaje del asistente"])
                self.assertEqual(d.estado, estado)
                self.assertEqual(d.accion, accion)
                self.assertFalse(d.fallback)

    def test_terminado_y_bucle_no_llevan_mensaje(self):
        for estado in ("terminado", "bucle"):
            with self.subTest(estado=estado):
                with mock.patch.object(
                    clasificador,
                    "_pedir_a_ollama",
                    return_value=respuesta(estado, "no debería enviarse"),
                ):
                    d = clasificador.clasificar(["texto"])
                self.assertEqual(d.mensaje, "")

    def test_mensaje_vacio_se_rellena_con_sigue(self):
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("cortado", "")
        ):
            d = clasificador.clasificar(["texto"])
        self.assertEqual(d.mensaje, "sigue")

    def test_confianza_se_acota_entre_0_y_1(self):
        with mock.patch.object(
            clasificador,
            "_pedir_a_ollama",
            return_value=respuesta("cortado", "sigue", confianza=7.5),
        ):
            d = clasificador.clasificar(["texto"])
        self.assertEqual(d.confianza, 1.0)


class TestFallback(unittest.TestCase):
    """Ante cualquier fallo debe comportarse como el programa actual."""

    def _esperar_fallback(self, efecto):
        with mock.patch.object(clasificador, "_pedir_a_ollama", side_effect=efecto):
            d = clasificador.clasificar(["texto"])
        self.assertTrue(d.fallback)
        self.assertEqual(d.accion, "enviar")
        self.assertEqual(d.mensaje, "sigue")

    def test_ollama_caido(self):
        self._esperar_fallback(urllib.error.URLError("conexión rechazada"))

    def test_timeout(self):
        self._esperar_fallback(TimeoutError())

    def test_json_invalido(self):
        with mock.patch.object(
            clasificador,
            "_pedir_a_ollama",
            return_value={"message": {"content": "esto no es json"}},
        ):
            d = clasificador.clasificar(["texto"])
        self.assertTrue(d.fallback)
        self.assertEqual(d.mensaje, "sigue")

    def test_estado_inventado(self):
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("inventado", "x")
        ):
            d = clasificador.clasificar(["texto"])
        self.assertTrue(d.fallback)

    def test_sin_mensajes(self):
        d = clasificador.clasificar([])
        self.assertTrue(d.fallback)
        self.assertEqual(d.mensaje, "sigue")


class TestReglasDeSesion(unittest.TestCase):
    def test_debounce_bloquea_el_segundo_envio(self):
        reloj = Reloj()
        sup = Supervisor(reloj=reloj)
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("cortado", "sigue")
        ):
            primera = sup.decidir(["a"])
            segunda = sup.decidir(["b"])
        self.assertEqual(primera.accion, "enviar")
        self.assertEqual(segunda.accion, "esperar")

    def test_pasado_el_debounce_vuelve_a_enviar(self):
        reloj = Reloj()
        sup = Supervisor(reloj=reloj)
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("cortado", "sigue")
        ):
            sup.decidir(["a"])
            reloj.avanzar(config.DEBOUNCE_S + 1)
            segunda = sup.decidir(["b"])
        self.assertEqual(segunda.accion, "enviar")

    def test_bucles_seguidos_acaban_avisando(self):
        reloj = Reloj()
        sup = Supervisor(reloj=reloj)
        acciones = []
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("bucle")
        ):
            for i in range(config.MAX_BUCLES + 1):
                acciones.append(sup.decidir([f"repetido {i}"]).accion)
                reloj.avanzar(config.DEBOUNCE_S + 1)
        self.assertIn("avisar", acciones)

    def test_mismo_estado_repetido_acaba_avisando(self):
        reloj = Reloj()
        sup = Supervisor(reloj=reloj)
        ultima = None
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("cortado", "sigue")
        ):
            for _ in range(config.MAX_ENVIOS_MISMO_ESTADO):
                ultima = sup.decidir(["texto"])
                reloj.avanzar(config.DEBOUNCE_S + 1)
        self.assertEqual(ultima.accion, "avisar")

    def test_terminado_para_sin_enviar_nada(self):
        sup = Supervisor(reloj=Reloj())
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("terminado")
        ):
            d = sup.decidir(["Listo, ya está todo."])
        self.assertEqual(d.accion, "parar")
        self.assertEqual(d.mensaje, "")

    def test_reiniciar_limpia_contadores(self):
        reloj = Reloj()
        sup = Supervisor(reloj=reloj)
        with mock.patch.object(
            clasificador, "_pedir_a_ollama", return_value=respuesta("cortado", "sigue")
        ):
            sup.decidir(["a"])
            sup.reiniciar()
            d = sup.decidir(["b"])
        self.assertEqual(d.accion, "enviar")


class TestDeteccionDeRepeticion(unittest.TestCase):
    def test_textos_casi_iguales_se_detectan(self):
        a = "El enfoque recomendado es usar una caché para mejorar el rendimiento."
        b = "El enfoque recomendado es usar una caché para mejorar el rendimiento!"
        self.assertTrue(clasificador._repite([a, b]))

    def test_textos_distintos_no(self):
        self.assertFalse(
            clasificador._repite(["Voy a crear la función.", "Ya terminé, aquí tienes."])
        )

    def test_un_solo_mensaje_no_es_repeticion(self):
        self.assertFalse(clasificador._repite(["uno"]))


if __name__ == "__main__":
    unittest.main()
