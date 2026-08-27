#!/usr/bin/env bash
# Espera a que termine el gate 4 y, en cuanto acabe, informa del cierre.
# Se rinde a los 540 s para no chocar con el limite de 600 s del ejecutor.
set +e
G4=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m
LIMITE=540
t=0
while [ $t -lt $LIMITE ]; do
  if ! pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
    echo "TERMINADA a los ${t}s de espera (hora UTC $(date -u +%H:%M:%S))"
    echo "--- cierre del launcher ---"
    tail -5 "$G4/launcher_console.log"
    echo "--- ficheros parciales (deben ser 0) ---"
    find "$G4/capture" -name '*.partial' -o -name '*.tmp' | wc -l
    echo "--- volumen final ---"
    du -sh "$G4/capture"
    echo "GATE4_FIN_OK"
    exit 0
  fi
  sleep 15
  t=$((t+15))
done
P=$(pgrep -f 'binance_collector[.]dual_main' | head -1)
echo "SIGUE VIVA tras ${LIMITE}s (hora UTC $(date -u +%H:%M:%S)) transcurrido=$(ps -o etime= -p "$P" | tr -d ' ')"
echo "GATE4_AUN_CORRIENDO"
