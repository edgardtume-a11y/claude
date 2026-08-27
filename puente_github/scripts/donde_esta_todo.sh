#!/usr/bin/env bash
# ¿Que hay exactamente en la maquina y donde? Sin suponer nada.
# Hay que distinguir dos cosas que se confunden facil:
#   1. Los DATOS comprimidos de esta noche (los parquet, dentro de staging_runs)
#   2. Un RESPALDO empaquetado .tar.gz del sistema entero (que puede no existir)
set +e

echo "=== 1) LOS DATOS COMPRIMIDOS (lo de esta noche) ==="
du -sh /home/trading/jean-flow-exec/staging_runs 2>/dev/null
echo "ficheros parquet: $(find /home/trading/jean-flow-exec/staging_runs -name '*.parquet' 2>/dev/null | wc -l)"
echo "ficheros csv    : $(find /home/trading/jean-flow-exec/staging_runs -name '*.csv' 2>/dev/null | wc -l)"
echo
echo "--- tamano de cada captura ---"
du -sh /home/trading/jean-flow-exec/staging_runs/* 2>/dev/null | sort -h

echo
echo "=== 2) ¿EXISTE ALGUN RESPALDO EMPAQUETADO? ==="
ls -lah /home/trading/*.tar.gz /home/trading/*.zip /home/trading/respaldo* 2>/dev/null
find /home/trading -maxdepth 2 -name '*.tar.gz' -o -maxdepth 2 -name '*.tgz' -o -maxdepth 2 -name '*.zip' 2>/dev/null | head
echo "(si no aparece nada arriba, NO existe ningun respaldo empaquetado)"

echo
echo "=== 3) el guion de respaldo, ¿esta disponible? ==="
ls -la /home/trading/puente_github_repo/puente_github/scripts/respaldo_total.sh 2>&1

echo
echo "=== 4) disco ==="
df -h /home | tail -1
echo "DONDE_ESTA_OK"
