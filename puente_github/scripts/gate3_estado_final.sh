#!/usr/bin/env bash
# Radiografia del gate 3 ya detenido: que dejaron las auditorias y la captura.
set +e
G3=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
echo "=== 1) contenido de audit/ ==="
ls -la "$G3/audit/" 2>&1 | head -40
echo
echo "=== 2) run_live_audits.sh ==="
sed -n '1,80p' "$G3/control/run_live_audits.sh" 2>&1
echo
echo "=== 3) archivos JSON en audit/ (primeras lineas) ==="
for f in "$G3"/audit/*.json; do
  [ -f "$f" ] || continue
  echo "--- $(basename "$f") ($(stat -c%s "$f") bytes)"
  head -c 1200 "$f"; echo
done
echo
echo "=== 4) capture/: tamano y ficheros ==="
du -sh "$G3/capture" 2>&1
find "$G3/capture" -name '*.csv' -printf '%s %p\n' 2>/dev/null | sort -rn | head -10
echo
echo "=== 5) final del launcher_console.log ==="
tail -25 "$G3/launcher_console.log" 2>&1
echo "GATE3_ESTADO_OK"
