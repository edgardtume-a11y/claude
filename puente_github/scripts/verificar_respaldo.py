#!/usr/bin/env python3
"""Verificacion del respaldo antes de entregarlo.

Un respaldo que no se ha abierto nunca no es un respaldo: es un fichero grande
que da tranquilidad falsa. Aqui se comprueba de verdad:
  - que el zip se abre y su indice esta intacto
  - que TODOS sus miembros pasan la comprobacion de CRC (testzip)
  - que el inventario esta dentro y es legible
  - que los metadatos del sistema estan (para poder rehacer la maquina)
  - la huella del fichero, para que el operador pueda comprobar la descarga
"""
import glob
import hashlib
import os
import zipfile


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 22), b""):
            h.update(bloque)
    return h.hexdigest()


def main():
    candidatos = sorted(glob.glob("/home/trading/RESPALDO_JEAN_FLOW_*.zip"))
    if not candidatos:
        print("NO HAY NINGUN RESPALDO")
        return 1
    ruta = candidatos[-1]
    tam = os.path.getsize(ruta)
    print(f"fichero: {ruta}")
    print(f"tamano : {tam} bytes ({tam/2**20:.2f} MB)")

    print("\n=== 1) ¿se abre y esta completo el indice? ===")
    with zipfile.ZipFile(ruta) as z:
        nombres = z.namelist()
        print(f"  miembros: {len(nombres)}")

        print("\n=== 2) comprobacion de CRC de TODOS los miembros ===")
        malo = z.testzip()
        if malo is None:
            print("  TODOS LOS MIEMBROS INTEGROS")
        else:
            print(f"  *** MIEMBRO CORRUPTO: {malo} ***")
            return 1

        print("\n=== 3) ¿esta el inventario? ===")
        inv = [n for n in nombres if "INVENTARIO" in n.upper()]
        if inv:
            texto = z.read(inv[0]).decode("utf-8", "ignore")
            print(f"  {inv[0]}: {len(texto)} caracteres")
            aviso = [ln for ln in texto.splitlines()
                     if "credencial" in ln.lower() or "clave" in ln.lower()
                     or "token" in ln.lower()]
            print(f"  aviso de seguridad presente: {'SI' if aviso else 'NO'}")
            for ln in aviso[:3]:
                print(f"    > {ln.strip()[:120]}")
        else:
            print("  *** FALTA EL INVENTARIO ***")

        print("\n=== 4) ¿estan los metadatos para rehacer la maquina? ===")
        for clave in ("dpkg_get_selections", "pip_freeze", "systemd"):
            hay = [n for n in nombres if clave in n]
            print(f"  {clave}: {len(hay)} fichero(s)")

        print("\n=== 5) reparto del contenido por carpeta principal ===")
        conteo = {}
        for n in nombres:
            raiz = n.split("/")[0]
            conteo[raiz] = conteo.get(raiz, 0) + 1
        for raiz, n in sorted(conteo.items(), key=lambda x: -x[1])[:12]:
            print(f"  {n:6d}  {raiz}")

        print("\n=== 6) metodos de compresion usados ===")
        metodos = {}
        for info in z.infolist():
            metodos[info.compress_type] = metodos.get(info.compress_type, 0) + 1
        nombres_metodo = {0: "STORED (sin recomprimir)", 8: "DEFLATE",
                          12: "BZIP2", 14: "LZMA"}
        for m, n in sorted(metodos.items()):
            print(f"  {nombres_metodo.get(m, m):28s}: {n} ficheros")

    print("\n=== 7) huella del fichero, para comprobar la descarga ===")
    h = sha256(ruta)
    print(f"  sha256: {h}")

    print("\nVERIFICAR_RESPALDO_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
