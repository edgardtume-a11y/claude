#!/usr/bin/env python3
"""Prueba de humo: ¿uvloop arranca de verdad con este Python y esta version?

Que las pruebas pasen solo demuestra que el codigo menciona uvloop. Si
asyncio.run(..., loop_factory=uvloop.new_event_loop) fuese incompatible con
CPython 3.12 o con uvloop 0.22.1, la captura moriria al arrancar y perderiamos
media hora. Se comprueba aqui, en dos segundos, antes de lanzar nada.
"""
import asyncio
import gc
import sys

print("python:", sys.version.split()[0])

try:
    import uvloop
except ImportError as exc:
    print("uvloop NO IMPORTABLE:", exc)
    print("HUMO_FALLA")
    raise SystemExit(1)

print("uvloop:", getattr(uvloop, "__version__", "desconocida"))


async def tarea():
    bucle = asyncio.get_running_loop()
    await asyncio.sleep(0.01)
    return type(bucle).__module__ + "." + type(bucle).__name__


# 1) el mismo patron exacto que quedo en dual_main.py
nombre = asyncio.run(tarea(), loop_factory=uvloop.new_event_loop)
print("bucle en uso:", nombre)
if "uvloop" not in nombre.lower():
    print("EL BUCLE NO ES UVLOOP")
    print("HUMO_FALLA")
    raise SystemExit(1)

# 2) el camino de respaldo debe seguir funcionando
nombre_std = asyncio.run(tarea())
print("bucle de respaldo:", nombre_std)

# 3) gc.freeze y su contador
antes = gc.get_freeze_count()
gc.freeze()
print("gc congelados: antes=%d despues=%d" % (antes, gc.get_freeze_count()))
if gc.get_freeze_count() <= 0:
    print("gc.freeze no congelo nada")
    print("HUMO_FALLA")
    raise SystemExit(1)

# 4) el modulo modificado debe seguir importandose de verdad, no solo compilar
sys.path.insert(0, "/home/trading/jean-flow-exec/staging_runs/"
                   "20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src")
import binance_collector.dual_main as dm  # noqa: E402
print("dual_main importado, version del paquete:",
      getattr(dm, "__version__", "?"))
print("tiene _validate_stop_request:", hasattr(dm, "_validate_stop_request"))

print("HUMO_UVLOOP_OK")
