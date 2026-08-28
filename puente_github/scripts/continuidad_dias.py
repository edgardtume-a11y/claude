#!/usr/bin/env python3
"""Comprueba que los certificados diarios encajan entre si.

POR QUE HACE FALTA
------------------
La auditoria de 7 dias no cabe en memoria: el auditor gasta ~290 MB por cada
millon de filas y `identity`, que carga los dos mercados a la vez, pediria
~28 GB de los 32 de la maquina. La salida es certificar DIA A DIA.

Pero siete certificados diarios NO equivalen a uno semanal: cada `journal`
comprueba la continuidad de `ingest_seq` DENTRO de su grupo de ficheros y no
sabe nada del dia anterior. Entre el ultimo evento de un dia y el primero del
siguiente queda un hueco sin comprobar por nadie.

Esta herramienta comprueba exactamente esas costuras.

QUE COMPRUEBA, POR MERCADO
--------------------------
1. Contigüidad: ultimo ingest_seq del tramo N + 1 == primer ingest_seq del N+1.
   Un salto significa eventos perdidos entre dias; un retroceso o repeticion,
   solapamiento.
2. Misma sesion de captura: capture_session_id identico en toda la semana.
   Si cambia, hubo un reinicio y no es una captura continua.
3. Mismo esquema: schema_version identico.
4. Orden temporal: el tramo N+1 empieza despues de que acabe el N.

LO QUE NO COMPRUEBA
-------------------
La integridad DENTRO de cada tramo: de eso ya se encarga `journal`, y esta
herramienta no lo repite. Aqui solo se miran los bordes.

USO
---
  continuidad_dias.py --mercado usdm_futures TRAMO1 TRAMO2 [TRAMO3 ...]

Cada TRAMO es un directorio o un patron. Se ordenan por nombre, que en este
proyecto es cronologico (events-<marca de tiempo>-<n>).
Lee .csv y .parquet indistintamente.

Codigo de salida: 0 si todas las costuras encajan, 2 si alguna no.
"""
import argparse
import csv
import glob
import json
import os
import sys

try:
    import pyarrow.parquet as pq
except ImportError:
    pq = None

COLUMNAS = ("ingest_seq", "capture_session_id", "schema_version",
            "receive_utc_ns", "market", "record_type")


def ficheros_de(patron):
    """Devuelve los segmentos cerrados de un tramo, en orden cronologico."""
    if os.path.isdir(patron):
        encontrados = (glob.glob(os.path.join(patron, "*.csv"))
                       + glob.glob(os.path.join(patron, "*.parquet")))
    else:
        encontrados = glob.glob(patron)
    # .csv.partial es un fichero que la captura esta escribiendo: no se toca
    return sorted(f for f in encontrados
                  if (f.endswith(".csv") or f.endswith(".parquet"))
                  and not f.endswith(".csv.partial"))


def _fila_util(fila):
    """Solo interesan las filas con ingest_seq: las de control no lo llevan."""
    v = (fila.get("ingest_seq") or "").strip()
    return v not in ("", "None")


def _cabecera_csv(ruta):
    with open(ruta, "r", encoding="utf-8", newline="") as fh:
        return next(csv.reader(fh))


def _primera_csv(ruta):
    """Primera fila util. Se lee desde arriba y se para en cuanto aparece."""
    with open(ruta, "r", encoding="utf-8", newline="") as fh:
        for fila in csv.DictReader(fh):
            if _fila_util(fila):
                return {k: fila.get(k, "") for k in COLUMNAS}
    return None


def _ultima_csv(ruta, cola=1 << 20):
    """Ultima fila util, leyendo solo el final del fichero.

    Un segmento son 512 MB: recorrerlo entero para ver su ultima linea costaria
    minutos por fichero, y en 7 dias eso son horas. Se lee la cola y se sube
    hacia atras. Si en el ultimo MB no hubiera ninguna fila util -- no deberia
    pasar, son cientos de miles de filas -- se amplia la ventana.
    """
    cabecera = _cabecera_csv(ruta)
    tam = os.path.getsize(ruta)
    while cola <= max(tam, 1):
        with open(ruta, "rb") as fh:
            fh.seek(max(0, tam - cola))
            bruto = fh.read().decode("utf-8", "ignore")
        # la primera linea del trozo puede venir cortada por la mitad
        lineas = bruto.splitlines()[1:] if tam > cola else bruto.splitlines()[1:]
        for linea in reversed(lineas):
            if not linea.strip():
                continue
            try:
                valores = next(csv.reader([linea]))
            except Exception:
                continue
            if len(valores) != len(cabecera):
                continue          # linea cortada o con salto embebido: se salta
            fila = dict(zip(cabecera, valores))
            if _fila_util(fila):
                return {k: fila.get(k, "") for k in COLUMNAS}
        if cola >= tam:
            break
        cola *= 8
    return None


def bordes_csv(ruta):
    """(primera, ultima) sin recorrer el fichero entero."""
    return _primera_csv(ruta), _ultima_csv(ruta)


def bordes_parquet(ruta):
    """Igual, leyendo solo el primer y el ultimo grupo de filas."""
    if pq is None:
        raise RuntimeError("pyarrow no esta disponible y hay ficheros .parquet")
    fichero = pq.ParquetFile(ruta)
    n_grupos = fichero.num_row_groups

    def _filas(indice):
        tabla = fichero.read_row_group(indice)
        nombres = tabla.column_names
        cols = {c: tabla.column(c).to_pylist() for c in COLUMNAS if c in nombres}
        n = tabla.num_rows
        for i in range(n):
            yield {c: ("" if cols.get(c, [None] * n)[i] is None
                       else str(cols[c][i])) for c in COLUMNAS}

    primera = ultima = None
    for g in range(n_grupos):
        for fila in _filas(g):
            if _fila_util(fila):
                primera = fila
                break
        if primera is not None:
            break
    for g in range(n_grupos - 1, -1, -1):
        for fila in _filas(g):
            if _fila_util(fila):
                ultima = fila          # se queda con la ultima util del grupo
        if ultima is not None:
            break
    return primera, ultima


def bordes(ruta):
    return bordes_parquet(ruta) if ruta.endswith(".parquet") else bordes_csv(ruta)


def resumen_tramo(nombre, ficheros):
    """El primer y el ultimo evento del tramo.

    Solo hacen falta DOS ficheros: el primero y el ultimo del tramo. Los de en
    medio ya los comprueba `journal`, que certifica la continuidad dentro del
    grupo; repetirlos aqui costaria minutos por dia sin anadir nada.
    """
    primera, _ = bordes(ficheros[0])
    _, ultima = bordes(ficheros[-1])
    # si el primer o el ultimo segmento no tuviera eventos utiles, se busca hacia dentro
    i = 1
    while primera is None and i < len(ficheros):
        primera, _ = bordes(ficheros[i]); i += 1
    j = len(ficheros) - 2
    while ultima is None and j >= 0:
        _, ultima = bordes(ficheros[j]); j -= 1
    sesiones, esquemas = set(), set()
    for fila in (primera, ultima):
        if fila:
            sesiones.add(fila.get("capture_session_id", ""))
            esquemas.add(fila.get("schema_version", ""))
    return {"tramo": nombre, "ficheros": len(ficheros),
            "primera": primera, "ultima": ultima,
            "sesiones": sorted(sesiones), "esquemas": sorted(esquemas)}


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mercado", required=True,
                   choices=("spot", "usdm_futures"),
                   help="mercado al que pertenecen los tramos")
    p.add_argument("tramos", nargs="+",
                   help="directorios o patrones, uno por dia, en orden")
    args = p.parse_args()

    resumenes, errores = [], []
    for t in args.tramos:
        fs = ficheros_de(t)
        if not fs:
            errores.append(f"{t}: no contiene segmentos cerrados")
            continue
        r = resumen_tramo(t, fs)
        if r["primera"] is None:
            errores.append(f"{t}: ningun evento con ingest_seq")
            continue
        resumenes.append(r)

    # invariantes de toda la semana
    todas_sesiones = {s for r in resumenes for s in r["sesiones"] if s}
    todos_esquemas = {e for r in resumenes for e in r["esquemas"] if e}
    if len(todas_sesiones) > 1:
        errores.append("capture_session_id distinto entre tramos "
                       f"({sorted(todas_sesiones)}): no es una captura continua")
    if len(todos_esquemas) > 1:
        errores.append(f"schema_version distinto entre tramos ({sorted(todos_esquemas)})")

    # las costuras
    costuras = []
    for a, b in zip(resumenes, resumenes[1:]):
        ult = int(a["ultima"]["ingest_seq"])
        pri = int(b["primera"]["ingest_seq"])
        hueco = pri - ult - 1
        t_a = int(a["ultima"].get("receive_utc_ns") or 0)
        t_b = int(b["primera"].get("receive_utc_ns") or 0)
        costura = {
            "de": a["tramo"], "a": b["tramo"],
            "ultimo_ingest_seq": ult, "primer_ingest_seq": pri,
            "hueco": hueco,
            "orden_temporal_ok": t_b >= t_a,
            "pass": hueco == 0 and t_b >= t_a,
        }
        if hueco > 0:
            errores.append(f"{a['tramo']} -> {b['tramo']}: faltan {hueco} eventos "
                           f"(salta de {ult} a {pri})")
        elif hueco < 0:
            errores.append(f"{a['tramo']} -> {b['tramo']}: solapamiento de "
                           f"{-hueco} eventos (de {ult} a {pri})")
        if not costura["orden_temporal_ok"]:
            errores.append(f"{a['tramo']} -> {b['tramo']}: el segundo tramo "
                           "empieza antes de que acabe el primero")
        costuras.append(costura)

    salida = {
        "mercado": args.mercado,
        "tramos": [{"tramo": r["tramo"], "ficheros": r["ficheros"],
                    "primer_ingest_seq": int(r["primera"]["ingest_seq"]),
                    "ultimo_ingest_seq": int(r["ultima"]["ingest_seq"])}
                   for r in resumenes],
        "capture_session_ids": sorted(todas_sesiones),
        "schema_versions": sorted(todos_esquemas),
        "costuras": costuras,
        "errores": errores,
        "certification": "PASS" if (not errores and costuras) else "FAIL",
    }
    if not costuras and not errores:
        salida["certification"] = "FAIL"
        salida["errores"] = ["hacen falta al menos dos tramos para comprobar una costura"]

    print(json.dumps(salida, indent=2, ensure_ascii=False, sort_keys=True))
    return 0 if salida["certification"] == "PASS" else 2


if __name__ == "__main__":
    sys.exit(main())
