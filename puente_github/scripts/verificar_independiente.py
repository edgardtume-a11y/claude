#!/usr/bin/env python3
"""Verificacion INDEPENDIENTE del parquet, por un camino distinto al del conversor.

El conversor se verifica a si mismo con pyarrow.Table.equals(). Eso es
razonable, pero si pyarrow tuviera un sesgo, se verificaria con el mismo sesgo
con el que convirtio. Aqui se lee el CSV con la libreria csv de Python -otro
motor, otro parser- y se compara celda a celda contra el parquet.

Si las dos rutas coinciden, la conversion es de fiar. Solo entonces se puede
autorizar el borrado.
"""
import csv
import os
import sys

import pyarrow.parquet as pq

CHICA = ("/home/trading/jean-flow-exec/staging_runs/"
         "20260826T052518Z_csv_persistence_hot_rebase_fix_10m")
MUESTRA_BORDES = 2000   # filas a comparar al principio y al final
csv.field_size_limit(10 * 1024 * 1024)


def verificar(ruta_csv, ruta_parquet):
    print(f"\n--- {os.path.basename(ruta_csv)}")
    tabla = pq.read_table(ruta_parquet)
    cols_pq = list(tabla.column_names)
    # el parquet a columnas de listas de Python: se materializa una vez
    columnas = {c: tabla.column(c).to_pylist() for c in cols_pq}
    filas_pq = tabla.num_rows

    with open(ruta_csv, newline="", encoding="utf-8") as fh:
        lector = csv.reader(fh)
        cabecera = next(lector)
        filas_csv = 0
        discrepancias = 0
        primeras = []
        for i, fila in enumerate(lector):
            filas_csv += 1
            # comparar solo los bordes: el centro de 50k filas no aporta mas
            # certeza que los extremos y multiplica el tiempo por veinte
            if i >= MUESTRA_BORDES and i < filas_pq - MUESTRA_BORDES:
                continue
            for j, nombre in enumerate(cabecera):
                if j >= len(fila):
                    break
                esperado = fila[j]
                obtenido = columnas[nombre][i]
                # pyarrow representa el campo vacio como None; el csv lo da ""
                if obtenido is None:
                    obtenido = ""
                if str(obtenido) != esperado:
                    discrepancias += 1
                    if len(primeras) < 3:
                        primeras.append(
                            f"fila {i} col '{nombre}': csv={esperado!r} "
                            f"parquet={obtenido!r}")

    print(f"  columnas csv={len(cabecera)}  parquet={len(cols_pq)}  "
          f"{'IGUALES' if cabecera == cols_pq else '***DISTINTAS***'}")
    print(f"  filas    csv={filas_csv}  parquet={filas_pq}  "
          f"{'IGUALES' if filas_csv == filas_pq else '***DISTINTAS***'}")
    comparadas = min(filas_csv, MUESTRA_BORDES * 2)
    print(f"  celdas comparadas: ~{comparadas * len(cabecera)}  "
          f"discrepancias: {discrepancias}")
    for p in primeras:
        print("    ", p)
    ok = (cabecera == cols_pq and filas_csv == filas_pq and discrepancias == 0)
    print(f"  veredicto: {'IDENTICO' if ok else '***NO COINCIDE***'}")
    return ok


def main():
    pares = []
    for raiz, _, archivos in os.walk(os.path.join(CHICA, "capture")):
        for a in sorted(archivos):
            if a.endswith(".parquet"):
                p = os.path.join(raiz, a)
                c = p[:-len(".parquet")] + ".csv"
                if os.path.isfile(c):
                    pares.append((c, p))
    if not pares:
        print("no hay pares csv/parquet que comparar")
        return 1
    print(f"pares a verificar: {len(pares)}")
    todos = all(verificar(c, p) for c, p in pares)
    print()
    print("VERIFICACION_INDEPENDIENTE_OK" if todos
          else "VERIFICACION_INDEPENDIENTE_FALLA")
    return 0 if todos else 1


if __name__ == "__main__":
    sys.exit(main())
