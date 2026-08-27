#!/usr/bin/env bash
# Solo lectura: muestra cómo el launcher implementa el contrato de parada.
R=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
echo "=== LINEAS DE STOP EN launch_live.sh ==="
grep -nE 'STOP|stop_' "$R/control/launch_live.sh" | head -20
echo "=== PIDS REGISTRADOS ==="
for f in PID.txt HB_PID.txt LAUNCHER_PID.txt SESSION_ID.txt; do
  printf '%s: %s\n' "$f" "$(cat "$R/$f" 2>/dev/null || echo ausente)"
done
echo "=== ARCHIVOS EN LA RAIZ ==="
ls -1 "$R"
echo INSPECCION_OK
