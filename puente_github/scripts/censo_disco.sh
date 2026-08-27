#!/usr/bin/env bash
# ¿Que ocupa el disco realmente? Antes de comprimir 43 GB hay que saber de que
# estan hechos: comprimir lo que ya esta comprimido no sirve de nada, y meter
# el sistema operativo entero en un zip es peso muerto que se reinstala solo.
set +e

echo "=== 1) ocupacion por directorio de primer nivel ==="
du -sh /* 2>/dev/null | sort -h | tail -15

echo
echo "=== 2) dentro de /home/trading (lo que de verdad es tuyo) ==="
du -sh /home/trading/* 2>/dev/null | sort -h | tail -20

echo
echo "=== 3) los 15 ficheros mas grandes de /home ==="
find /home -type f -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -15 \
  | awk -F'\t' '{printf "%8.1f MB  %s\n", $1/1048576, $2}'

echo
echo "=== 4) que compresores hay instalados ==="
for c in zip 7z 7za xz zstd gzip bzip2 pigz pbzip2 brotli; do
  p=$(command -v $c 2>/dev/null)
  if [ -n "$p" ]; then echo "  $c: SI ($p)"; else echo "  $c: no"; fi
done

echo
echo "=== 5) cuantos nucleos hay para comprimir en paralelo ==="
nproc

echo
echo "=== 6) disco ==="
df -h / | tail -1
echo "CENSO_OK"
