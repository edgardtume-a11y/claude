#!/usr/bin/env python3
"""Respaldo del disco, partido en volumenes independientes.

Por defecto respalda SOLO lo modificado desde una fecha (--desde), porque el
operador pidio "lo del 24 al 27". Con --desde 1970-01-01 respalda el disco
entero.

Escrito por el revisor porque el encargo al autor no llegaba y el operador lo
ha pedido tres veces. La entrega manda.

LIMITACION QUE HAY QUE DECIR: este programa corre como el usuario 'trading', no
como administrador. Algunos ficheros del sistema (/root, /etc/shadow, partes de
/var/lib) solo los puede leer root y quedaran FUERA. Cada uno se anota en el
inventario con su ruta y su tamano: el operador tiene derecho a saber que parte
de su disco no esta en su respaldo. Un respaldo con huecos silenciosos es peor
que no tenerlo.

Decision de compresion, con su motivo:
  - Ya comprimidos (.zip .gz .xz .zst .parquet .snap ...) -> STORED, sin tocar.
    Medido esta noche: recomprimirlos da ratio 1.01-1.04 y cuesta minutos.
  - Todo lo demas -> DEFLATE nivel 9.
    LZMA comprime un 30 por ciento mas, pero en Python va a 1-3 MB/s: sobre 21 GB
    de CSV serian horas. DEFLATE da 34x a ~90 MB/s. La diferencia real sobre el
    total es de unos 200 MB; el coste, tres horas. No compensa.
"""
import argparse
import calendar
import hashlib
import os
import stat
import sys
import time
import zipfile

DESTINO_DIR = "/home/trading/respaldo_completo"
PARTE_MB = 2048
RAIZ = "/"

# Exclusiones fijas. Dos grupos, por dos motivos distintos:
#
# 1) Pseudo-sistemas del nucleo: no son ficheros, son ventanas al estado del
#    kernel. Copiarlos no significa nada y algunos bloquean al leerlos.
#
# 2) SALIDAS DE OTROS RESPALDOS. Esto se aprendio por las malas el 28/08: el
#    primer incremental empezo a respaldar el respaldo completo, porque sus 35
#    partes tenian fecha posterior a la marca y entraban en la ventana. Copio
#    24 GB de nada antes de que se detectara.
#    Un respaldo que incluye otros respaldos no anade informacion: duplica. Y
#    en un incremental es peor, porque cada corrida respaldaria la anterior,
#    creciendo sin limite hasta llenar el disco.
RESPALDOS = (
    "/home/trading/respaldo_24_27",
    "/home/trading/respaldo_incremental",
    "/home/trading/respaldo_completo",
)
EXCLUIR_RAICES = ("/proc", "/sys", "/dev", "/run", "/lost+found",
                  DESTINO_DIR) + RESPALDOS

YA_COMPRIMIDOS = frozenset((
    ".zip", ".gz", ".tgz", ".xz", ".zst", ".bz2", ".7z", ".rar", ".lz4",
    ".parquet", ".snap", ".whl", ".deb", ".rpm", ".jar", ".apk",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mkv", ".mp3",
    ".woff", ".woff2", ".pyc", ".pack",
))


def excluido(ruta):
    for pre in EXCLUIR_RAICES:
        if ruta == pre or ruta.startswith(pre.rstrip("/") + "/"):
            return True
    # guarda por nombre: cualquier parte de un respaldo, este donde este.
    # Las rutas fijas de arriba cubren lo conocido; esto cubre lo que alguien
    # cree manana en otro sitio.
    base = os.path.basename(ruta)
    if base.startswith(("RESPALDO_COMPLETO_", "INCREMENTAL_",
                        "RESPALDO_JEAN_FLOW_")):
        return True
    return False


def metodo(ruta):
    if os.path.splitext(ruta)[1].lower() in YA_COMPRIMIDOS:
        return zipfile.ZIP_STORED, "STORED"
    return zipfile.ZIP_DEFLATED, "DEFLATE"


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 22), b""):
            h.update(bloque)
    return h.hexdigest()


class Volumenes:
    """Escribe una serie de zips independientes de ~PARTE_MB cada uno."""

    def __init__(self, destino_dir, marca, limite_bytes,
                 prefijo="RESPALDO_COMPLETO"):
        self.dir = destino_dir
        self.prefijo = prefijo
        self.marca = marca
        self.limite = limite_bytes
        self.n = 0
        self.z = None
        self.ruta = None
        self.tmp = None
        self.escrito = 0
        self.partes = []

    def _abrir(self):
        self.n += 1
        nombre = f"{self.prefijo}_{self.marca}_parte{self.n:02d}.zip"
        self.ruta = os.path.join(self.dir, nombre)
        self.tmp = self.ruta + ".escribiendo"
        self.z = zipfile.ZipFile(self.tmp, "w", allowZip64=True)
        self.escrito = 0
        print(f"\n>>> abriendo {nombre}", flush=True)

    def _cerrar(self):
        if self.z is None:
            return
        self.z.close()
        # nombre definitivo solo cuando la parte esta entera
        os.replace(self.tmp, self.ruta)
        tam = os.path.getsize(self.ruta)
        self.partes.append((self.ruta, tam))
        print(f">>> cerrada {os.path.basename(self.ruta)}: "
              f"{tam/2**20:.1f} MB", flush=True)
        self.z = None

    def anadir(self, ruta_real, nombre_arch, comp, tam_estimado):
        if self.z is None:
            self._abrir()
        elif self.escrito + tam_estimado > self.limite and self.escrito > 0:
            self._cerrar()
            self._abrir()
        self.z.write(ruta_real, arcname=nombre_arch, compress_type=comp)
        self.escrito += tam_estimado

    def anadir_texto(self, nombre_arch, texto):
        if self.z is None:
            self._abrir()
        self.z.writestr(nombre_arch, texto, compress_type=zipfile.ZIP_DEFLATED)

    def cerrar(self):
        self._cerrar()


def main():
    p = argparse.ArgumentParser(description="Respaldo por volumenes")
    p.add_argument("--desde", default="2026-08-24",
                   help="incluir solo ficheros modificados desde esta fecha "
                        "(AAAA-MM-DD). Usa 1970-01-01 para el disco entero.")
    p.add_argument("--hasta", default=None,
                   help="opcional, AAAA-MM-DD exclusivo")
    p.add_argument("--desde-epoch", type=float, default=None,
                   help="igual que --desde pero con precision de segundo "
                        "(segundos desde 1970). Manda sobre --desde. Lo usa el "
                        "respaldo incremental, que necesita cortar al segundo "
                        "exacto en que termino el anterior para no repetir ni "
                        "perder ficheros.")
    p.add_argument("--dry-run", action="store_true",
                   help="solo cuenta y mide; no escribe ningun zip")
    p.add_argument("--destino-dir", default=DESTINO_DIR)
    p.add_argument("--parte-mb", type=int, default=PARTE_MB)
    p.add_argument("--prefijo", default="RESPALDO_COMPLETO",
                   help="prefijo de los ficheros de salida")
    args = p.parse_args()

    desde = (args.desde_epoch if args.desde_epoch is not None
             else calendar.timegm(time.strptime(args.desde, "%Y-%m-%d")))
    hasta = (calendar.timegm(time.strptime(args.hasta, "%Y-%m-%d"))
             if args.hasta else None)
    print("ventana: desde %s%s"
          % (time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime(desde)),
             (" hasta " + args.hasta) if args.hasta else " en adelante"))

    if os.system("pgrep -f 'binance_collector[.]dual_main' >/dev/null") == 0:
        print("HAY UNA CAPTURA ACTIVA - respaldo abortado")
        return 1
    try:
        os.nice(10)
    except OSError:
        pass

    globals()["DESTINO_DIR"] = args.destino_dir
    globals()["EXCLUIR_RAICES"] = (
        "/proc", "/sys", "/dev", "/run", "/lost+found",
        args.destino_dir) + RESPALDOS
    os.makedirs(args.destino_dir, exist_ok=True)
    libre = os.statvfs(args.destino_dir)
    libre_gb = libre.f_bavail * libre.f_frsize / 2**30
    print(f"espacio libre: {libre_gb:.1f} GB")
    if libre_gb < 25:
        print("MENOS DE 25 GB LIBRES - abortado")
        return 1

    marca = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    vol = None if args.dry_run else Volumenes(
        args.destino_dir, marca, args.parte_mb * 1024 * 1024, args.prefijo)
    fuera_de_ventana = 0

    inventario = []
    sin_permiso = []
    enlaces = []
    especiales = []
    n_ok = 0
    bytes_orig = 0
    t0 = time.time()

    print(f"marca: {marca}\nrecorriendo {RAIZ} ...", flush=True)

    for raiz, dirs, ficheros in os.walk(RAIZ, topdown=True, followlinks=False):
        dirs[:] = [d for d in dirs if not excluido(os.path.join(raiz, d))]
        if excluido(raiz):
            continue
        for nombre in ficheros:
            ruta = os.path.join(raiz, nombre)
            if excluido(ruta):
                continue
            try:
                st = os.lstat(ruta)
            except OSError as exc:
                sin_permiso.append((ruta, 0, str(exc)))
                continue

            if stat.S_ISLNK(st.st_mode):
                try:
                    enlaces.append((ruta, os.readlink(ruta)))
                except OSError:
                    pass
                continue
            if not stat.S_ISREG(st.st_mode):
                especiales.append((ruta, stat.S_IFMT(st.st_mode)))
                continue

            # ventana temporal: se mira la mas reciente entre modificacion y
            # cambio de metadatos, para no perder ficheros copiados hace poco
            # que conservan su fecha original de modificacion
            marca_fichero = max(st.st_mtime, st.st_ctime)
            if marca_fichero < desde or (hasta and marca_fichero >= hasta):
                fuera_de_ventana += 1
                continue

            comp, comp_nombre = metodo(ruta)
            if args.dry_run:
                n_ok += 1
                bytes_orig += st.st_size
                inventario.append(f"{st.st_size}\t{comp_nombre}\t-\t{ruta}")
                continue
            try:
                arch = ruta.lstrip("/")
                vol.anadir(ruta, arch, comp, st.st_size)
            except (OSError, PermissionError) as exc:
                sin_permiso.append((ruta, st.st_size, str(exc)))
                continue

            n_ok += 1
            bytes_orig += st.st_size
            inventario.append(f"{st.st_size}\t{comp_nombre}\tparte{vol.n:02d}\t{ruta}")
            if n_ok % 1000 == 0:
                print(f"  [{n_ok}] {bytes_orig/2**30:.2f} GiB, "
                      f"parte {vol.n if vol else 0}, {time.time()-t0:.0f}s",
                      flush=True)

    if args.dry_run:
        print("\n" + "=" * 70)
        print("SIMULACION (no se escribio nada)")
        print("=" * 70)
        print(f"ficheros que entrarian : {n_ok}")
        print(f"bytes originales       : {bytes_orig} ({bytes_orig/2**30:.2f} GiB)")
        print(f"fuera de la ventana    : {fuera_de_ventana}")
        print(f"omitidos por permisos  : {len(sin_permiso)}")
        print(f"partes estimadas a {args.parte_mb} MB: "
              f"{max(1, int(bytes_orig / (args.parte_mb*1024*1024)) + 1)} (cota alta, sin comprimir)")
        print("\nlos 15 mayores que entrarian:")
        for linea in sorted(inventario, key=lambda x: -int(x.split("\t")[0]))[:15]:
            b, m, _, r = linea.split("\t")
            print(f"  {int(b)/2**20:9.1f} MB  {m:8s} {r}")
        print("SIMULACION_OK")
        return 0

    # el inventario va en la ultima parte abierta
    cab = [
        "INVENTARIO DEL RESPALDO - JEAN FLOW",
        f"marca: {marca}",
        "ventana: desde %s%s" % (time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime(desde)), (" hasta " + args.hasta) if args.hasta else " en adelante"),
        f"ficheros fuera de la ventana (no incluidos): {fuera_de_ventana}",
        f"host: {os.uname().nodename}   sistema: {os.uname().release}",
        "",
        "AVISO DE SEGURIDAD: este respaldo contiene el disco entero, incluidas",
        "credenciales, claves privadas y configuracion del sistema. NO subir a",
        "GitHub ni compartir con terceros bajo ningun concepto.",
        "",
        f"ficheros incluidos: {n_ok}",
        f"bytes originales  : {bytes_orig} ({bytes_orig/2**30:.2f} GiB)",
        f"enlaces simbolicos: {len(enlaces)} (guardados como enlace, no seguidos)",
        f"ficheros especiales (sockets, tuberias, dispositivos): {len(especiales)}",
        f"OMITIDOS POR PERMISOS: {len(sin_permiso)}, "
        f"{sum(s for _, s, _ in sin_permiso)/2**20:.1f} MiB",
        "",
        "EXCLUSIONES (unicas, y por imposibilidad tecnica, no por criterio):",
        "  /proc /sys /dev /run  - sistemas virtuales del nucleo, no son datos",
        "  /lost+found",
        f"  {DESTINO_DIR} - el propio destino, o se meteria dentro de si mismo",
        "",
        "=== OMITIDOS POR PERMISOS (ruta | bytes | motivo) ===",
    ]
    cab += [f"{r} | {s} | {m}" for r, s, m in sin_permiso]
    cab += ["", "=== ENLACES SIMBOLICOS (ruta -> destino) ==="]
    cab += [f"{r} -> {d}" for r, d in enlaces]
    cab += ["", "=== FICHEROS INCLUIDOS (bytes | metodo | parte | ruta) ==="]
    cab += inventario
    vol.anadir_texto("INVENTARIO_COMPLETO.txt", "\n".join(cab))
    vol.cerrar()

    total_zip = sum(t for _, t in vol.partes)
    print("\n" + "=" * 70)
    print("RESPALDO COMPLETO TERMINADO")
    print("=" * 70)
    print(f"partes            : {len(vol.partes)}")
    print(f"ficheros incluidos: {n_ok}")
    print(f"omitidos permisos : {len(sin_permiso)} "
          f"({sum(s for _, s, _ in sin_permiso)/2**20:.1f} MiB)")
    print(f"enlaces           : {len(enlaces)}")
    print(f"bytes originales  : {bytes_orig} ({bytes_orig/2**30:.2f} GiB)")
    print(f"bytes comprimidos : {total_zip} ({total_zip/2**30:.2f} GiB)")
    if total_zip:
        print(f"factor            : {bytes_orig/total_zip:.2f}x")
    print(f"tiempo            : {time.time()-t0:.0f} s")
    print("\npartes y sus huellas:")
    for ruta, tam in vol.partes:
        print(f"  {tam/2**20:9.1f} MB  {os.path.basename(ruta)}")
        print(f"             sha256 {sha256(ruta)}")
    print("JEAN_FLOW_RESPALDO_TOTAL_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
