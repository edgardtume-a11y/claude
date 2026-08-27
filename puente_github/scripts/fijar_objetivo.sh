#!/usr/bin/env bash
# Escribe cual es la siguiente captura a convertir, eligiendo automaticamente
# la mas pequena que aun conserve ficheros CSV.
#
# Se separa de la conversion a proposito: asi el revisor ve que se va a tocar
# ANTES de que se toque, y el orden -de menor a mayor- garantiza que cualquier
# sorpresa aparezca en el fichero mas barato de perder.
set +e
BASE=/home/trading/jean-flow-exec/staging_runs
DESTINO=/home/trading/objetivo_conversion.txt

echo "=== capturas que todavia tienen CSV, de menor a mayor ==="
ELEGIDA=""
for d in $(du -s "$BASE"/* 2>/dev/null | sort -n | cut -f2); do
  n=$(find "$d/capture" -name '*.csv' 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] || continue
  t=$(du -sh "$d/capture" 2>/dev/null | cut -f1)
  echo "  $t  [$n CSV]  $(basename "$d")"
  [ -z "$ELEGIDA" ] && ELEGIDA="$d"
done

if [ -z "$ELEGIDA" ]; then
  echo "NO QUEDA NINGUNA CAPTURA CON CSV - conversion completa"
  : > "$DESTINO"
  echo "TODO_CONVERTIDO"
  exit 0
fi

echo "$ELEGIDA" > "$DESTINO"
echo
echo "siguiente objetivo: $(basename "$ELEGIDA")"
echo "OBJETIVO_FIJADO_OK"
