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


def bordes_csv(ruta):
    """(primera, ultima) fila con ingest_seq. Una sola pasada, sin cargar todo."""
    primera = ultima = None
    with open(ruta, "r", encoding="utf-8", newline="") as fh:
        for fila in csv.DictReader(fh):
            if not _fila_util(fila):
                continue
            if primera is None:
                primera = {k: fila.get(k, "") for k in COLUMNAS}
            ultima = {k: fila.get(k, "") for k in COLUMNAS}
    return primera, ultima


def bordes_parquet(ruta):
    """Igual, pero por lotes: un segmento son ~1.3 millones de filas."""
    if pq is None:
        raise RuntimeError("pyarrow no esta disponible y hay ficheros .parquet")
    fichero = pq.ParquetFile(ruta)
    primera = ultima = None
    for lote in fichero.iter_batches():
        nombres = lote.schema.names
        cols = {c: lote.column(nombres.index(c)).to_pylist()
                for c in COLUMNAS if c in nombres}
        n = lote.num_rows
        for i in range(n):
            fila = {c: ("" if cols.get(c, [None] * n)[i] is None
                        else str(cols[c][i])) for c in COLUMNAS}
            if not _fila_util(fila):
                continue
            if primera is None:
                primera = fila
            ultima = fila
    return primera, ultima


def bordes(ruta):
    return bordes_parquet(ruta) if ruta.endswith(".parquet") else bordes_csv(ruta)


def resumen_tramo(nombre, ficheros):
    """El primer y el ultimo evento del tramo entero, y sus invariantes."""
    primera = ultima = None
    sesiones, esquemas = set(), set()
    for f in ficheros:
        p, u = bordes(f)
        if p is None:
            continue                      # segmento sin eventos con ingest_seq
        if primera is None:
            primera = p
        ultima = u
        for fila in (p, u):
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
