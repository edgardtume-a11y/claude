#!/usr/bin/env bash
# Banco de compresores sobre datos reales. Version 2: muestra de 50 MB en vez
# de 200, y se ejecuta en segundo plano.
#
# La v1 murio en el limite de 600 s del puente: xz -9 sobre 200 MB tarda
# muchisimo. La leccion ya estaba escrita esta noche
# (operaciones/LECCION_PUENTE_SERIAL.md) y la volvi a saltar: nada largo debe
# correr dentro de una orden.
#
# Todos los candidatos son SIN PERDIDA: lo que sale al descomprimir es identico
# bit a bit a lo que entro.
set +e
LAB=/home/trading/banco_compresion
rm -rf "$LAB"; mkdir -p "$LAB"
MUESTRA_MB=50

CSV=$(find /home/trading/restore_stage_20260825 -name '*.csv' -size +100M 2>/dev/null | head -1)
head -c $((MUESTRA_MB*1024*1024)) "$CSV" > "$LAB/csv.dat" 2>/dev/null
tar -C /home/trading -cf - --exclude='__pycache__' --exclude='.git' jean-flow-v2.4.1 2>/dev/null \
  | head -c $((MUESTRA_MB*1024*1024)) > "$LAB/codigo.dat"

echo "=== muestras ==="
echo "  csv    : $(stat -c%s "$LAB/csv.dat") bytes (de $(basename "$CSV"))"
echo "  codigo : $(stat -c%s "$LAB/codigo.dat") bytes"
echo

medir() {
  local nombre="$1" cmd="$2" fuente="$3"
  local ini fin dur orig comp
  orig=$(stat -c%s "$fuente")
  ini=$(date +%s%N)
  eval "$cmd" > "$LAB/out.bin" 2>/dev/null
  fin=$(date +%s%N)
  comp=$(stat -c%s "$LAB/out.bin" 2>/dev/null || echo 0)
  dur=$(( (fin-ini)/1000000 ))
  if [ "$comp" -gt 0 ]; then
    awk -v n="$nombre" -v o="$orig" -v c="$comp" -v d="$dur" \
      'BEGIN{printf "  %-20s %7.1f MB -> %7.2f MB  %6.2fx  %6.1f s  %6.1f MB/s\n", n, o/1048576, c/1048576, o/c, d/1000, (o/1048576)/(d/1000+0.001)}'
  else
    echo "  $nombre: FALLO"
  fi
  rm -f "$LAB/out.bin"
}

for M in csv codigo; do
  F="$LAB/$M.dat"
  [ -s "$F" ] || continue
  echo "########## muestra: $M ##########"
  medir "gzip -9"          "gzip -9 -c '$F'"                        "$F"
  medir "bzip2 -9"         "bzip2 -9 -c '$F'"                       "$F"
  medir "zstd -3"          "zstd -3 -T8 -c '$F'"                    "$F"
  medir "zstd -12"         "zstd -12 -T8 -c '$F'"                   "$F"
  medir "zstd -19"         "zstd -19 -T8 -c '$F'"                   "$F"
  medir "zstd -22 --long"  "zstd --ultra -22 --long=27 -T8 -c '$F'" "$F"
  medir "xz -6 -T8"        "xz -6 -T8 -c '$F'"                      "$F"
  medir "xz -9 -T8"        "xz -9 -T8 -c '$F'"                      "$F"
  echo
done

echo "########## zip desde Python (formato de entrega) ##########"
/usr/bin/python3 - "$LAB" <<'PYEOF'
import os, sys, time, zipfile
lab = sys.argv[1]
for muestra in ("csv", "codigo"):
    f = os.path.join(lab, muestra + ".dat")
    if not os.path.exists(f) or not os.path.getsize(f):
        continue
    orig = os.path.getsize(f)
    print(f"--- {muestra} ({orig/2**20:.1f} MB)")
    for nombre, metodo, nivel in (
            ("zip deflate -9", zipfile.ZIP_DEFLATED, 9),
            ("zip bzip2", zipfile.ZIP_BZIP2, 9),
            ("zip lzma", zipfile.ZIP_LZMA, None)):
        destino = os.path.join(lab, "p.zip")
        t0 = time.time()
        try:
            kw = {"compresslevel": nivel} if nivel else {}
            with zipfile.ZipFile(destino, "w", compression=metodo, **kw) as z:
                z.write(f, arcname="dato")
            comp = os.path.getsize(destino)
            d = time.time() - t0
            print(f"  {nombre:<16} {orig/2**20:7.1f} MB -> {comp/2**20:7.2f} MB"
                  f"  {orig/comp:6.2f}x  {d:6.1f} s  {(orig/2**20)/max(d,0.001):6.1f} MB/s")
        except Exception as exc:
            print(f"  {nombre:<16} FALLO: {exc}")
        finally:
            if os.path.exists(destino):
                os.remove(destino)
PYEOF

rm -rf "$LAB"
echo "BANCO_COMPRESION_OK"
