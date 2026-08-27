#!/usr/bin/env python3
"""¿Se puede volver del Parquet al CSV, y el auditor lo acepta?

Esto hay que probarlo ANTES de borrar 32 GB, no despues. El auditor
(audit.py) busca exclusivamente ficheros *.csv: la palabra "parquet" no
aparece ni una vez en su codigo. Asi que borrar los CSV significa que esas
capturas solo se podran re-auditar si la vuelta atras es fiel.

Se comprueba lo mas exigente posible: que el CSV reconstruido sea IDENTICO
BYTE A BYTE al original. Si lo es, borrar es reversible sin perdida.
"""
import hashlib
import os
import subprocess
import sys

import pyarrow.csv as pc
import pyarrow.parquet as pq

CHICA = ("/home/trading/jean-flow-exec/staging_runs/"
         "20260826T052518Z_csv_persistence_hot_rebase_fix_10m")
TRABAJO = "/home/trading/vuelta_atras_tmp"
PY = ("/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector"
      "/.venv/bin/python")


def sha(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def main():
    os.makedirs(TRABAJO, exist_ok=True)
    pares = []
    for raiz, _, archivos in os.walk(os.path.join(CHICA, "capture")):
        for a in sorted(archivos):
            if a.endswith(".parquet"):
                p = os.path.join(raiz, a)
                c = p[:-len(".parquet")] + ".csv"
                if os.path.isfile(c):
                    pares.append((c, p))
    if not pares:
        print("no hay pares que comparar")
        return 1

    todos_iguales = True
    reconstruidos = []
    for original, parquet in pares:
        nombre = os.path.basename(original)
        destino = os.path.join(TRABAJO, nombre)
        tabla = pq.read_table(parquet)
        # se escribe sin entrecomillado innecesario para reproducir el CSV
        # tal y como lo genero el colector
        pc.write_csv(
            tabla, destino,
            write_options=pc.WriteOptions(include_header=True,
                                          quoting_style="none"))
        h_orig = sha(original)
        h_nuevo = sha(destino)
        igual = h_orig == h_nuevo
        todos_iguales &= igual
        reconstruidos.append(destino)
        print(f"\n--- {nombre}")
        print(f"  original     {os.path.getsize(original):>12} bytes  {h_orig[:16]}")
        print(f"  reconstruido {os.path.getsize(destino):>12} bytes  {h_nuevo[:16]}")
        print(f"  {'IDENTICO BYTE A BYTE' if igual else '*** DIFIERE ***'}")
        if not igual:
            # si difiere, saber en que: puede ser solo el formato del texto
            with open(original, encoding="utf-8", errors="ignore") as fa, \
                 open(destino, encoding="utf-8", errors="ignore") as fb:
                for i, (la, lb) in enumerate(zip(fa, fb)):
                    if la != lb:
                        print(f"    primera diferencia en la linea {i}:")
                        print(f"      original: {la[:200]!r}")
                        print(f"      vuelta  : {lb[:200]!r}")
                        break

    print("\n=== ¿el auditor acepta el CSV reconstruido? ===")
    r = subprocess.run(
        [PY, "-m", "binance_collector.audit", "journal"] + reconstruidos[:1],
        capture_output=True, text=True, timeout=300,
        env=dict(os.environ,
                 PYTHONPATH="/home/trading/jean-flow-v2.4.1/555/"
                            "binance_phase1_collector/src"))
    print("codigo de retorno:", r.returncode,
          "(0 = el auditor lo leyo y certifico)")
    salida = (r.stdout + r.stderr)
    print(salida[:900] if salida else "(sin salida)")

    print()
    if todos_iguales and r.returncode == 0:
        print("VUELTA_ATRAS_OK")
        return 0
    print("VUELTA_ATRAS_CON_REPAROS")
    return 1


if __name__ == "__main__":
    sys.exit(main())
