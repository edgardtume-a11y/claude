#!/usr/bin/env python3
"""Registra operaciones EJECUTADAS con el lado agresor. Base del volume profile.

POR QUE HACE FALTA, SI YA GRABAMOS EL LIBRO
    El libro dice lo que la gente OFRECE. Las operaciones dicen lo que
    realmente PASO. Son datos distintos:
      libro       -> book map / DOM   : donde esta la liquidez en reposo
      operaciones -> volume profile   : a que precios se negocio de verdad
                     footprint        : cuanto compro el agresor y cuanto vendio

EL LADO AGRESOR
    Binance devuelve "m" = isBuyerMaker.
      m = true  -> el comprador esperaba en el libro; agredio el VENDEDOR
      m = false -> el vendedor esperaba; agredio el COMPRADOR

SIN HUECOS
    Pide por fromId encadenado, no "los ultimos N". La secuencia de ids queda
    continua y se puede verificar que no falta ninguna operacion.

NO manda ordenes. NO lee claves. Escribe comprimido en su propia carpeta.
"""
import gzip
import json
import os
import signal
import time
import urllib.request
from pathlib import Path

SIMBOLO = os.environ.get("SIMBOLO", "BTCUSDT")
MERCADO = os.environ.get("MERCADO", "fut")          # "spot" o "fut"
CADENCIA = float(os.environ.get("CADENCIA_S", "1.0"))
DURACION = float(os.environ.get("DURACION_S", "0"))
SALIDA = Path(os.environ.get("SALIDA", "/home/trading/basis/trades_fut.jsonl.gz"))

BASE = ("https://api.binance.com/api/v3/aggTrades" if MERCADO == "spot"
        else "https://fapi.binance.com/fapi/v1/aggTrades")

_parar = False


def _senal(sig, frame):
    global _parar
    _parar = True


signal.signal(signal.SIGINT, _senal)
signal.signal(signal.SIGTERM, _senal)


def pedir(params):
    url = BASE + "?" + "&".join("%s=%s" % kv for kv in params.items())
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            return json.loads(r.read())
    except Exception:
        return None


def main():
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    print("registrador de OPERACIONES  |  solo lectura, sin claves")
    print("  simbolo : %s   mercado: %s" % (SIMBOLO, MERCADO))
    print("  salida  : %s  (gzip)" % SALIDA)
    print("", flush=True)

    ultimo = None
    inicio = time.monotonic()
    total = 0
    huecos = 0
    f = gzip.open(SALIDA, "at", encoding="utf-8")

    try:
        while not _parar:
            if ultimo is None:
                lote = pedir({"symbol": SIMBOLO, "limit": 1000})
            else:
                lote = pedir({"symbol": SIMBOLO, "fromId": ultimo + 1, "limit": 1000})

            if lote:
                nuevos = 0
                for t in lote:
                    tid = t["a"]
                    if ultimo is not None and tid <= ultimo:
                        continue
                    if ultimo is not None and tid > ultimo + 1 and nuevos == 0:
                        huecos += 1
                    f.write(json.dumps({
                        "id": tid,
                        "ms": t["T"],
                        "precio": t["p"],
                        "cantidad": t["q"],
                        "agresor": "vendedor" if t["m"] else "comprador",
                    }, separators=(",", ":")) + "\n")
                    ultimo = tid
                    nuevos += 1
                total += nuevos

                if total and nuevos:
                    f.flush()
                    p = float(lote[-1]["p"])
                    print("  %8d operaciones | ultimo precio %11.2f | +%4d | %5.2f MB"
                          % (total, p, nuevos, SALIDA.stat().st_size / 1e6), flush=True)

            if DURACION and time.monotonic() - inicio >= DURACION:
                break
            time.sleep(CADENCIA)
    finally:
        f.close()

    mb = SALIDA.stat().st_size / 1e6 if SALIDA.exists() else 0
    dur = time.monotonic() - inicio
    print("\n  %d operaciones, %d huecos | %.2f MB" % (total, huecos, mb))
    if dur > 0 and mb > 0:
        print("  proyeccion: %.1f MB/dia" % (mb / dur * 86400))


if __name__ == "__main__":
    main()
