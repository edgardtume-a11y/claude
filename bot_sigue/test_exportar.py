"""Pruebas del extractor de pares. Usa un export sintético con la misma
forma que el conversations.json real: árbol con ramas, current_node,
roles, contenido no textual y duplicados."""

from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory

from bot_sigue import exportar_chatgpt as ex


def _msg(rol, texto, ts=1_700_000_000.0, tipo="text"):
    return {
        "author": {"role": rol},
        "create_time": ts,
        "content": {"content_type": tipo, "parts": [texto]},
    }


def _nodo(id_, msg, parent, children):
    return {"id": id_, "message": msg, "parent": parent, "children": children}


def export_sintetico():
    """root → sys → u1 → a1 → u2 (rama actual)
                          ↘ a1b → u2b (rama abandonada por regeneración)"""
    mapping = {
        "root": _nodo("root", None, None, ["sys"]),
        "sys": _nodo("sys", _msg("system", "sistema"), "root", ["u1"]),
        "u1": _nodo("u1", _msg("user", "Monta el parser de logs"), "sys", ["a1", "a1b"]),
        "a1": _nodo("a1", _msg("assistant", "¿Los logs vienen en JSON o en texto plano?"),
                    "u1", ["u2"]),
        "u2": _nodo("u2", _msg("user", "Texto plano, una línea por evento."), "a1", ["a2"]),
        "a2": _nodo("a2", _msg("assistant", "Vale, empiezo:\n```python\ndef leer(ru"),
                    "u2", ["u3"]),
        "u3": _nodo("u3", _msg("user", "ok"), "a2", ["a3"]),          # demasiado corta
        "a3": _nodo("a3", _msg("assistant", "imagen", tipo="image_asset_pointer"),
                    "u3", ["u4"]),                                     # no es texto
        "u4": _nodo("u4", _msg("user", "Mejor sin imágenes, solo texto."), "a3", []),
        # rama abandonada: nunca debe salir
        "a1b": _nodo("a1b", _msg("assistant", "¿Prefieres CSV?"), "u1", ["u2b"]),
        "u2b": _nodo("u2b", _msg("user", "No, esta rama no cuenta para nada."), "a1b", []),
    }
    return {"title": "Parser de logs", "current_node": "u4", "mapping": mapping}


class TestCamino(unittest.TestCase):
    def test_sigue_la_rama_actual_y_no_la_abandonada(self):
        textos = [ex._texto(m) for m in ex._camino(export_sintetico())]
        self.assertIn("¿Los logs vienen en JSON o en texto plano?", textos)
        self.assertNotIn("¿Prefieres CSV?", textos)

    def test_orden_cronologico(self):
        roles = [m["author"]["role"] for m in ex._camino(export_sintetico())]
        self.assertEqual(roles[:3], ["system", "user", "assistant"])

    def test_sin_current_node_coge_una_hoja(self):
        conv = export_sintetico()
        del conv["current_node"]
        self.assertTrue(len(ex._camino(conv)) >= 3)


class TestExtraer(unittest.TestCase):
    def setUp(self):
        self.pares = ex.deduplicar(ex.extraer([export_sintetico()]))

    def test_extrae_solo_pares_asistente_usuario_validos(self):
        salidas = [p.salida for p in self.pares]
        self.assertIn("Texto plano, una línea por evento.", salidas)
        self.assertNotIn("ok", salidas)                                 # MIN_SALIDA
        self.assertNotIn("Mejor sin imágenes, solo texto.", salidas)    # entrada no textual
        self.assertNotIn("No, esta rama no cuenta para nada.", salidas) # rama abandonada

    def test_sugiere_pregunta_cuando_acaba_en_interrogacion(self):
        par = next(p for p in self.pares if "JSON o en texto" in p.entrada)
        self.assertEqual(par.sugerencia, "pregunta")
        self.assertEqual(par.estado, "")

    def test_conserva_titulo_y_fecha(self):
        self.assertEqual(self.pares[0].conversacion, "Parser de logs")
        self.assertEqual(self.pares[0].fecha, "2023-11-14")

    def test_recorta_la_entrada_a_la_cola(self):
        largo = {"author": {"role": "assistant"}, "content": {"content_type": "text",
                 "parts": ["x" * 3000 + "\n¿Sigo?"]}}
        corto = {"author": {"role": "user"}, "content": {"content_type": "text",
                 "parts": ["Sí, sigue con el mismo enfoque."]}}
        conv = {"title": "t", "current_node": "b",
                "mapping": {"a": _nodo("a", largo, None, ["b"]),
                            "b": _nodo("b", corto, "a", [])}}
        (par,) = list(ex.extraer([conv]))
        self.assertLessEqual(len(par.entrada), ex.COLA_ENTRADA)
        self.assertTrue(par.entrada.endswith("¿Sigo?"))

    def test_deduplica(self):
        dobles = ex.deduplicar(ex.extraer([export_sintetico(), export_sintetico()]))
        self.assertEqual(len(dobles), len(self.pares))


class TestCLI(unittest.TestCase):
    def test_escribe_jsonl_y_aceptar_sugerencias(self):
        with TemporaryDirectory() as d:
            entrada = Path(d) / "conversations.json"
            entrada.write_text(json.dumps([export_sintetico()]), encoding="utf-8")
            salida = Path(d) / "pares.jsonl"

            with redirect_stdout(io.StringIO()):
                rc = ex.main([str(entrada), "--salida", str(salida), "--aceptar-sugerencias"])
            self.assertEqual(rc, 0)

            filas = [json.loads(l) for l in salida.read_text(encoding="utf-8").splitlines()]
            self.assertTrue(filas)
            pregunta = next(f for f in filas if f["sugerencia"] == "pregunta")
            self.assertEqual(pregunta["estado"], "pregunta")

    def test_config_imprime_ejemplos_con_estado(self):
        with TemporaryDirectory() as d:
            entrada = Path(d) / "conversations.json"
            entrada.write_text(json.dumps([export_sintetico()]), encoding="utf-8")
            buf = io.StringIO()
            with redirect_stdout(buf):
                rc = ex.main([str(entrada), "--config", "2"])
            self.assertEqual(rc, 0)
            self.assertIn('"estado": "pregunta"', buf.getvalue())
            self.assertIn('"mensaje": "Texto plano, una línea por evento."', buf.getvalue())

    def test_archivo_inexistente(self):
        with redirect_stdout(io.StringIO()):
            self.assertEqual(ex.main(["/no/existe.json"]), 2)


if __name__ == "__main__":
    unittest.main()
