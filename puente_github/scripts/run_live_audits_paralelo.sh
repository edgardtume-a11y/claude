#!/usr/bin/env bash
# Auditoria de una captura con las CUATRO FASES EN PARALELO.
#
# Sustituto directo de control/run_live_audits.sh. Misma salida, mismos
# ficheros, mismo return_codes.json. Lo unico que cambia es que las cuatro
# fases arrancan a la vez en vez de una detras de otra.
#
# MEDIDO el 28/08 sobre una captura real de 61 minutos y 6,5 GB:
#     en serie    577 s
#     en paralelo 245 s        -> 2,35x
#     pico de memoria 1,6 GB de 32   |   pico de carga 2,65 de 8 nucleos
#     y los CUATRO informes salieron byte a byte identicos.
#
# POR QUE ES SEGURO
#   Las cuatro fases son de SOLO LECTURA sobre los CSV/Parquet y escriben a
#   ficheros distintos. journal_spot y journal_usdm ni siquiera leen los mismos
#   ficheros. No se toca audit.py: esto es el guion que lo llama.
#
# LIMITE QUE HAY QUE RESPETAR  (planes/MEMORIA_AUDITOR_7DIAS.md)
#   El auditor gasta ~58 MB + 290 MB por cada millon de filas. En paralelo
#   corren tres procesos grandes a la vez. Sobre UNA SEMANA entera pedirian
#   ~55 GB y la maquina tiene 32: NO CABE.
#   Por eso los 7 dias se auditan DIA A DIA, y cada dia con este guion.
#   Un dia son ~9,6 GB entre los tres. Holgado.
#
# USO
#   run_live_audits_paralelo.sh <ruta del staging> [<ruta del overlay>]
#   Si no se da el segundo argumento, usa <staging>/overlay/src.
#   El PYTHONPATH SIEMPRE es el de la captura, nunca el de la instalacion base:
#   la base no conoce FORCE_ORDER ni MARK_PRICE y fallaria.
set +e

run="${1:?falta la ruta del staging}"
overlay="${2:-$run/overlay/src}"
py=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

[ -d "$run/capture" ] || { echo "no existe $run/capture"; exit 1; }
[ -d "$overlay/binance_collector" ] || { echo "no existe $overlay/binance_collector"; exit 1; }

export PYTHONPATH="$overlay"
mkdir -p "$run/audit"

# Se aceptan .csv y .parquet: desde el 28/08 el auditor lee los dos, asi que
# esto funciona igual antes y despues de que el rotador comprima.
shopt -s nullglob
spot=("$run"/capture/spot/events-*.csv "$run"/capture/spot/events-*.parquet)
usdm=("$run"/capture/usdm_futures/events-*.csv "$run"/capture/usdm_futures/events-*.parquet)
shopt -u nullglob
met="$run/capture/jean_flow_metrics.jsonl"

if [ ${#spot[@]} -eq 0 ] || [ ${#usdm[@]} -eq 0 ]; then
  echo "faltan segmentos: spot=${#spot[@]} usdm=${#usdm[@]}"; exit 1
fi
echo "segmentos: spot=${#spot[@]} usdm=${#usdm[@]}"
echo "PYTHONPATH=$PYTHONPATH"

T0=$(date +%s)

"$py" -m binance_collector.audit journal "${spot[@]}" \
  >"$run/audit/journal_spot.json" 2>"$run/audit/journal_spot.stderr" &
p_spot=$!

"$py" -m binance_collector.audit journal "${usdm[@]}" \
  >"$run/audit/journal_usdm.json" 2>"$run/audit/journal_usdm.stderr" &
p_usdm=$!

"$py" -m binance_collector.audit identity "${spot[@]}" "${usdm[@]}" \
  >"$run/audit/identity.json" 2>"$run/audit/identity.stderr" &
p_ident=$!

"$py" -m binance_collector.audit metrics --event-loop-p99-ms 20 "$met" \
  >"$run/audit/metrics.json" 2>"$run/audit/metrics.stderr" &
p_met=$!

# Se espera a cada uno por su PID para quedarse con SU codigo de salida.
# Un `wait` a secas devolveria solo el del ultimo y perderiamos los otros tres.
wait $p_spot;  rc_spot=$?;     echo "journal_spot=$rc_spot"
wait $p_usdm;  rc_usdm=$?;     echo "journal_usdm=$rc_usdm"
wait $p_ident; rc_identity=$?; echo "identity=$rc_identity"
wait $p_met;   rc_metrics=$?;  echo "metrics=$rc_metrics"

T1=$(date +%s)
echo "duracion=$((T1-T0))s"

printf '{"journal_spot":%d,"journal_usdm":%d,"identity":%d,"metrics":%d}\n' \
  "$rc_spot" "$rc_usdm" "$rc_identity" "$rc_metrics" \
  > "$run/audit/return_codes.json"

echo AUDITS_FINISHED
if (( rc_spot == 0 && rc_usdm == 0 && rc_identity == 0 && rc_metrics == 0 )); then
  exit 0
fi
exit 1
