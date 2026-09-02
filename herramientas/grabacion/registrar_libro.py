#!/usr/bin/env python3
"""Registra N niveles del libro de spot y futuros. Solo lectura, sin claves.

POR QUE MUCHOS NIVELES Y NO UNO
    Con una sola linea solo sabes el mejor precio, y eso solo vale si operas
    una cantidad ridicula. En cuanto pides un tamano real te comes varios
    niveles: te llevas lo que hay al mejor precio, luego lo del siguiente,
    y asi. Eso se llama CAMINAR EL LIBRO y encarece la operacion.
    Medido: 20 niveles de spot no cubrian 200.000 USD; hicieron falta 46.

PESO EN LA API
    2 peticiones por segundo. Los limites son 6000/min en spot y 2400/min en
    futuros; esto usa una fraccion pequena. No interfiere con el colector,
    que va por websocket y no gasta este presupuesto.

TAMANO EN DISCO
    Escribe comprimido con gzip. Medido: ~7.8 MB/dia a 20 niveles.

NO manda ordenes. NO lee claves. Escribe solo en su propia carpeta.
"""
import gzip
import json
import os
import signal
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SPOT = "https://api.binance.com/api/v3/depth?symbol={}&limit={}"
FUT = "https://fapi.binance.com/fapi/v1/depth?symbol={}&limit={}"

SIMBOLO = os.environ.get("SIMBOLO", "BTCUSDT")
NIVELES = int(os.environ.get("NIVELES", "20"))
CADENCIA = float(os.environ.get("CADENCIA_S", "1.0"))
DURACION = float(os.environ.get("DURACION_S", "0"))
SALIDA = Path(os.environ.get("SALIDA", "/home/trading/basis/libro.jsonl.gz"))

_parar = False


def _senal(sig, frame):
    global _parar
    _parar = True


signal.signal(signal.SIGINT, _senal)
signal.signal(signal.SIGTERM, _senal)


def leer(url):
    try:
        t0 = time.perf_counter()
        with urllib.request.urlopen(url, timeout=5) as r:
            d = json.loads(r.read())
        d["_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)
        return d
    except Exception:
        return None


def compacto(d, n):
    """Deja solo [precio, cantidad] x n, como texto, para no perder precision."""
    return {
        "bids": [[b[0], b[1]] for b in d.get("bids", [])[:n]],
        "asks": [[a[0], a[1]] for a in d.get("asks", [])[:n]],
        "ms": d.get("_ms"),
    }


def main():
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    inicio = time.monotonic()
    n = 0
    fallos = 0

    print("registrador de LIBRO  |  solo lectura, sin claves, sin ordenes")
    print("  simbolo  : " + SIMBOLO)
    print("  niveles  : " + str(NIVELES) + " por lado, en cada mercado")
    print("  cadencia : " + str(CADENCIA) + " s")
    print("  salida   : " + str(SALIDA) + "  (gzip)")
    print("", flush=True)

    f = gzip.open(SALIDA, "at", encoding="utf-8")
    try:
        objetivo = time.monotonic()
        while not _parar:
            objetivo += CADENCIA
            s = leer(SPOT.format(SIMBOLO, NIVELES))
            ft = leer(FUT.format(SIMBOLO, NIVELES))

            if s and ft and s.get("bids") and ft.get("bids"):
                fila = {
                    "utc": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                    "simbolo": SIMBOLO,
                    "spot": compacto(s, NIVELES),
                    "fut": compacto(ft, NIVELES),
                }
                f.write(json.dumps(fila, separators=(",", ":")) + "\n")
                n += 1
                if n % 15 == 0:
                    f.flush()
                    sb = float(s["bids"][0][0])
                    sa = float(s["asks"][0][0])
                    fb = float(ft["bids"][0][0])
                    fa = float(ft["asks"][0][0])
                    sm = (sb + sa) / 2
                    fm = (fb + fa) / 2
                    print("  %6d filas | spot %11.2f | fut %11.2f | basis %+7.2f pb | %5.1f MB"
                          % (n, sm, fm, (fm - sm) / sm * 10000,
                             SALIDA.stat().st_size / 1e6), flush=True)
            else:
                fallos += 1

            if DURACION and time.monotonic() - inicio >= DURACION:
                break
            espera = objetivo - time.monotonic()
            if espera > 0:
                time.sleep(espera)
            else:
                objetivo = time.monotonic()
    finally:
        f.close()

    mb = SALIDA.stat().st_size / 1e6 if SALIDA.exists() else 0
    print("\n  %d filas, %d fallidas | %.2f MB comprimidos" % (n, fallos, mb))
    if n:
        print("  proyeccion: %.1f MB/dia a esta cadencia" % (mb / n * 86400 / CADENCIA))


if __name__ == "__main__":
    main()
