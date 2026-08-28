#!/usr/bin/env python3
"""Verificacion de las partes del respaldo antes de entregarlas.

Un respaldo que nadie ha abierto no es un respaldo. Aqui se comprueba, parte
por parte: que el zip se abre, que su indice esta entero, cuantos ficheros
lleva, y su huella para que el operador confirme la descarga.

La comprobacion de CRC de cada miembro (testzip) sobre 30 GB tardaria mucho, asi
que se hace solo sobre las partes pequenas y sobre una muestra de las grandes.
Se dice claramente que se comprobo del todo y que a muestreo: un respaldo con
verificaciones exageradas de palabra es peor que uno con limites declarados.
"""
import glob
import hashlib
import os
import zipfile

DIR = "/home/trading/respaldo_24_27"
LIMITE_TESTZIP_MB = 400   # por debajo de esto, se comprueba entero


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 22), b""):
            h.update(bloque)
    return h.hexdigest()


def main():
    partes = sorted(glob.glob(os.path.join(DIR, "*_parte*.zip")))
    if not partes:
        print("NO HAY PARTES")
        return 1
    a_medias = glob.glob(os.path.join(DIR, "*.escribiendo"))
    print(f"partes encontradas: {len(partes)}")
    print(f"partes a medias   : {len(a_medias)} "
          f"{'(el respaldo no ha terminado)' if a_medias else '(ninguna: cerrado)'}")
    print()

    total_bytes = 0
    total_miembros = 0
    fallos = []
    inventario_en = None

    print(f"{'parte':<10} {'tamano':>10} {'ficheros':>9}  {'indice':<8} "
          f"{'crc':<12} sha256")
    print("-" * 100)
    for ruta in partes:
        nombre = os.path.basename(ruta).split("_parte")[-1]
        tam = os.path.getsize(ruta)
        total_bytes += tam
        try:
            with zipfile.ZipFile(ruta) as z:
                nombres = z.namelist()
                total_miembros += len(nombres)
                indice = "OK"
                if any("INVENTARIO" in n.upper() for n in nombres):
                    inventario_en = os.path.basename(ruta)
                if tam <= LIMITE_TESTZIP_MB * 1024 * 1024:
                    malo = z.testzip()
                    crc = "COMPLETO" if malo is None else f"MAL:{malo[:20]}"
                    if malo:
                        fallos.append((ruta, malo))
                else:
                    # muestra: el primero, el del medio y el ultimo
                    muestra = [nombres[0], nombres[len(nombres)//2], nombres[-1]] \
                        if nombres else []
                    mal = None
                    for n in muestra:
                        try:
                            with z.open(n) as fh:
                                while fh.read(1 << 20):
                                    pass
                        except Exception as exc:
                            mal = f"{n}: {exc}"
                            break
                    crc = "MUESTRA-OK" if mal is None else f"MAL:{mal[:20]}"
                    if mal:
                        fallos.append((ruta, mal))
        except Exception as exc:
            indice = f"ROTO: {exc}"
            crc = "-"
            fallos.append((ruta, str(exc)))
            nombres = []
        print(f"{nombre:<10} {tam/2**20:9.1f}M {len(nombres):9d}  {indice:<8} "
              f"{crc:<12} {sha256(ruta)}")

    print("-" * 100)
    print(f"partes            : {len(partes)}")
    print(f"ficheros totales  : {total_miembros}")
    print(f"tamano total      : {total_bytes} bytes "
          f"({total_bytes/2**30:.2f} GiB)")
    print(f"inventario en     : {inventario_en or '*** NO ENCONTRADO ***'}")
    print(f"partes con fallo  : {len(fallos)}")
    for ruta, motivo in fallos:
        print(f"  {os.path.basename(ruta)}: {motivo}")
    print()
    print("nota: las partes de mas de "
          f"{LIMITE_TESTZIP_MB} MB se comprobaron a muestreo (primero, medio y "
          "ultimo fichero), no entero: verificar 30 GB de CRC tardaria horas.")
    print("VERIFICAR_PARTES_OK" if not fallos else "VERIFICAR_PARTES_CON_FALLOS")
    return 0 if not fallos else 1


if __name__ == "__main__":
    raise SystemExit(main())
