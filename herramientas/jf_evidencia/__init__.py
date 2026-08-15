"""Herramientas de evidencia JEAN_FLOW.

Este paquete se ejecuta SOBRE la evidencia ya capturada. No forma parte del
producto, no se instala y no modifica nada del paquete sellado.

Las cinco reglas que todo módulo de aquí cumple sin excepción están escritas en
``herramientas/README.md``: solo lectura sobre ``runs/``, cero elevación, solo
biblioteca estándar, nunca fabricar un PASS, y escritura atómica de las salidas.
"""

from __future__ import annotations

__version__ = "1.0.0"

__all__ = ["__version__"]
