#!/usr/bin/env python3
"""Verificacion RAPIDA de las partes: abre cada zip y lee su indice.

La version anterior calculaba el sha256 de cada parte y se paso del limite de
tiempo: son 30 GB de lectura. Aqui se comprueba lo estructural, que es
segundos: si el indice central del zip esta entero, el fichero no esta
truncado y su contenido es localizable. Las huellas se calculan aparte, en
segundo plano, si el operador las quiere para comprobar la descarga.
"""
import glob
import os
import zipfile

DIR = "/home/trading/respaldo_24_27"


def main():
    partes = sorted(glob.glob(os.path.join(DIR, "*_parte*.zip")))
    a_medias = glob.glob(os.path.join(DIR, "*.escribiendo"))
    print(f"partes: {len(partes)}   a medias: {len(a_medias)}")
    if a_medias:
        print("  ", [os.path.basename(p) for p in a_medias])
    print()
    total_b = 0
    total_f = 0
    fallos = []
    inv = None
    for ruta in partes:
        n = os.path.basename(ruta).split("_parte")[-1].replace(".zip", "")
        tam = os.path.getsize(ruta)
        total_b += tam
        try:
            with zipfile.ZipFile(ruta) as z:
                nombres = z.namelist()
                total_f += len(nombres)
                if any("INVENTARIO" in x.upper() for x in nombres):
                    inv = os.path.basename(ruta)
                estado = "OK"
        except Exception as exc:
            nombres = []
            estado = f"ROTO: {exc}"
            fallos.append((n, str(exc)))
        print(f"  parte{n}  {tam/2**20:9.1f} MB  {len(nombres):7d} ficheros  {estado}")

    print()
    print(f"TOTAL: {len(partes)} partes | {total_f} ficheros | "
          f"{total_b/2**30:.2f} GiB")
    print(f"inventario en: {inv or '*** NO ENCONTRADO ***'}")
    print(f"partes con fallo: {len(fallos)}")
    for n, m in fallos:
        print(f"  parte{n}: {m}")
    print("PARTES_OK" if not fallos and not a_medias else "PARTES_CON_REPAROS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
