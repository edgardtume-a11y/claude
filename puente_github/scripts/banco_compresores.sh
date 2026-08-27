#!/usr/bin/env bash
# ¿Que compresor conviene para el respaldo? Se mide sobre DATOS REALES del
# disco, no sobre lo que digan los manuales: cada tipo de dato comprime
# distinto y la unica forma de saberlo es probarlo aqui.
#
# Todos los candidatos son SIN PERDIDA: el fichero que sale al descomprimir es
# identico bit a bit al que entro. No existe la "compresion con perdida" para
# datos; eso solo aplica a imagen, audio y video.
set +e
LAB=/home/trading/banco_compresion
rm -rf "$LAB"; mkdir -p "$LAB"

# --- muestra 1: un CSV de captura real (lo que mas pesa en el disco) ---
CSV=$(find /home/trading/restore_stage_20260825 -name '*.csv' -size +100M 2>/dev/null | head -1)
head -c 200000000 "$CSV" > "$LAB/muestra_csv.dat" 2>/dev/null
echo "muestra CSV : $(stat -c%s "$LAB/muestra_csv.dat" 2>/dev/null) bytes  (de $(basename "$CSV"))"

# --- muestra 2: codigo y configuracion (texto denso, muy comprimible) ---
tar -C /home/trading -cf "$LAB/muestra_codigo.dat" \
  --exclude='__pycache__' --exclude='.git' \
  jean-flow-v2.4.1 2>/dev/null
echo "muestra codigo: $(stat -c%s "$LAB/muestra_codigo.dat") bytes"
echo

medir() {
  local nombre="$1" ext="$2" cmd="$3" fuente="$4"
  local ini fin dur orig comp
  orig=$(stat -c%s "$fuente")
  ini=$(date +%s%N)
  eval "$cmd" > "$LAB/salida.$ext" 2>/dev/null
  fin=$(date +%s%N)
  comp=$(stat -c%s "$LAB/salida.$ext" 2>/dev/null || echo 0)
  dur=$(( (fin-ini)/1000000 ))
  if [ "$comp" -gt 0 ]; then
    awk -v n="$nombre" -v o="$orig" -v c="$comp" -v d="$dur" \
      'BEGIN{printf "  %-22s %8.2f MB -> %8.2f MB   %6.2fx   %6.1f s   %6.1f MB/s\n", n, o/1048576, c/1048576, o/c, d/1000, (o/1048576)/(d/1000+0.001)}'
  else
    echo "  $nombre: FALLO"
  fi
  rm -f "$LAB/salida.$ext"
}

for M in muestra_csv muestra_codigo; do
  F="$LAB/$M.dat"
  [ -s "$F" ] || continue
  echo "=============== $M ==============="
  medir "gzip -9"            gz   "gzip -9 -c '$F'"                        "$F"
  medir "bzip2 -9"           bz2  "bzip2 -9 -c '$F'"                       "$F"
  medir "zstd -3 (rapido)"   zst  "zstd -3 -T8 -c '$F'"                    "$F"
  medir "zstd -19"           zst  "zstd -19 -T8 -c '$F'"                   "$F"
  medir "zstd -22 --long"    zst  "zstd --ultra -22 --long=27 -T8 -c '$F'" "$F"
  medir "xz -9 -T8"          xz   "xz -9 -T8 -c '$F'"                      "$F"
  echo
done

echo "=============== ZIP desde Python (para la entrega) ==============="
/usr/bin/python3 - "$LAB" <<'PYEOF'
import os, sys, time, zipfile
lab = sys.argv[1]
for muestra in ("muestra_csv", "muestra_codigo"):
    f = os.path.join(lab, muestra + ".dat")
    if not os.path.exists(f) or os.path.getsize(f) == 0:
        continue
    orig = os.path.getsize(f)
    print(f"--- {muestra} ({orig/2**20:.1f} MB)")
    for nombre, metodo, nivel in (
            ("zip deflate -9", zipfile.ZIP_DEFLATED, 9),
            ("zip bzip2", zipfile.ZIP_BZIP2, 9),
            ("zip lzma", zipfile.ZIP_LZMA, None)):
        destino = os.path.join(lab, "prueba.zip")
        t0 = time.time()
        try:
            kw = {"compresslevel": nivel} if nivel else {}
            with zipfile.ZipFile(destino, "w", compression=metodo, **kw) as z:
                z.write(f, arcname="dato")
            comp = os.path.getsize(destino)
            d = time.time() - t0
            print(f"  {nombre:<18} {orig/2**20:8.2f} MB -> {comp/2**20:8.2f} MB"
                  f"   {orig/comp:6.2f}x   {d:6.1f} s   {(orig/2**20)/max(d,0.001):6.1f} MB/s")
        except Exception as exc:
            print(f"  {nombre:<18} FALLO: {exc}")
        finally:
            if os.path.exists(destino):
                os.remove(destino)
PYEOF

rm -rf "$LAB"
echo "BANCO_COMPRESION_OK"
