#!/usr/bin/env python3
"""La vuelta atras: de Parquet a CSV, byte a byte igual al original.

Hace falta porque el auditor (audit.py) y el reconstructor (reconstruct.py)
buscan exclusivamente ficheros *.csv: la palabra "parquet" no aparece ni una
sola vez en su codigo. Borrar los CSV es reversible solo si existe esta
herramienta y funciona.

La prueba con pyarrow.csv.write_csv dio un fichero que el auditor certifica
(rc=0) pero que NO es identico byte a byte: pyarrow entrecomilla la cabecera y
termina las lineas con \\n, mientras el colector escribe sin comillas y con
\\r\\n. Por eso aqui se escribe con el modulo csv de Python, con el mismo
dialecto que uso el colector, y se comprueba la huella cuando hay original
contra el que comparar.

Uso:
  reconstruir_csv.py --parquet RUTA.parquet [--destino RUTA.csv]
  reconstruir_csv.py --staging RUTA_DE_CAPTURA     (todos los parquet)
"""
import argparse
import csv
import hashlib
import os
import sys

import pyarrow.parquet as pq

STAGING_PREFIX = "/home/trading/jean-flow-exec/staging_runs/"


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def reconstruir(ruta_parquet, destino=None):
    """Devuelve (destino, filas, huella, huella_original_o_None)."""
    if destino is None:
        destino = ruta_parquet[:-len(".parquet")] + ".csv"
    tabla = pq.read_table(ruta_parquet)
    columnas = tabla.column_names
    # to_pylist por columna y no por fila: una sola materializacion, y el
    # orden de las columnas se conserva tal cual venia
    datos = [tabla.column(c).to_pylist() for c in columnas]
    filas = tabla.num_rows

    # newline="" deja que el modulo csv controle el fin de linea; lineterminator
    # \r\n reproduce lo que escribe el colector
    with open(destino, "w", newline="", encoding="utf-8") as fh:
        escritor = csv.writer(fh, lineterminator="\r\n",
                              quoting=csv.QUOTE_MINIMAL)
        escritor.writerow(columnas)
        for i in range(filas):
            escritor.writerow(
                ["" if datos[j][i] is None else datos[j][i]
                 for j in range(len(columnas))])
    return destino, filas


def main():
    p = argparse.ArgumentParser(description=__doc__)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--parquet", help="un fichero .parquet concreto")
    g.add_argument("--staging", help="una captura entera: todos sus .parquet")
    p.add_argument("--destino", help="ruta de salida (solo con --parquet)")
    args = p.parse_args()

    objetivos = []
    if args.parquet:
        objetivos.append((args.parquet, args.destino))
    else:
        raiz_real = os.path.realpath(args.staging)
        if not raiz_real.startswith(STAGING_PREFIX):
            print("la captura debe estar bajo staging_runs")
            return 2
        for raiz, _, archivos in os.walk(os.path.join(raiz_real, "capture")):
            for a in sorted(archivos):
                if a.endswith(".parquet"):
                    objetivos.append((os.path.join(raiz, a), None))

    if not objetivos:
        print("no hay nada que reconstruir")
        return 1

    fallos = 0
    for ruta_parquet, destino in objetivos:
        existia = destino or ruta_parquet[:-len(".parquet")] + ".csv"
        huella_previa = sha256(existia) if os.path.isfile(existia) else None
        if huella_previa:
            # no se pisa un CSV que ya esta: se escribe al lado para comparar
            destino = existia + ".reconstruido"
        salida, filas = reconstruir(ruta_parquet, destino)
        huella = sha256(salida)
        print(f"\n{os.path.basename(ruta_parquet)}")
        print(f"  -> {salida}")
        print(f"  filas: {filas}  bytes: {os.path.getsize(salida)}")
        print(f"  huella: {huella[:16]}")
        if huella_previa:
            igual = huella == huella_previa
            print(f"  original: {huella_previa[:16]}  "
                  f"{'IDENTICO BYTE A BYTE' if igual else '*** DIFIERE ***'}")
            if not igual:
                fallos += 1

    print()
    print("RECONSTRUCCION_OK" if not fallos else "RECONSTRUCCION_CON_DIFERENCIAS")
    return 0 if not fallos else 1


if __name__ == "__main__":
    sys.exit(main())
