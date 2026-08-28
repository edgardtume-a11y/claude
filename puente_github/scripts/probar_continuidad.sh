#!/usr/bin/env bash
# Prueba de la comprobacion de continuidad entre dias.
#
# Lo que de verdad valida una comprobacion no es que apruebe lo bueno: es que
# SUSPENDA lo roto. Por eso hay tres casos y dos de ellos DEBEN fallar.
#
# Se usan los 10 segmentos de futuros de la captura real del operador,
# repartidos en dos "dias" con enlaces simbolicos. No se copia ni se mueve nada.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
H=/home/trading/puente_github_repo/puente_github/scripts/continuidad_dias.py
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m/capture/usdm_futures
L=/home/trading/prueba_continuidad
rm -rf "$L"; mkdir -p "$L"

mapfile -t F < <(ls -1 "$N"/events-*.csv | sort)
echo "segmentos disponibles: ${#F[@]}"
[ ${#F[@]} -lt 6 ] && { echo "hacen falta al menos 6"; exit 0; }

enlazar() { mkdir -p "$1"; shift; for f in "$@"; do ln -sf "$f" "$1/"; done; }
# ojo: enlazar recibe el destino primero
enlazar2() { local d="$1"; shift; mkdir -p "$d"; for f in "$@"; do ln -sf "$f" "$d/"; done; }

echo
echo "############ CASO 1: continuo (DEBE APROBAR) ############"
enlazar2 "$L/c1_dia1" "${F[@]:0:5}"
enlazar2 "$L/c1_dia2" "${F[@]:5:5}"
"$PY" "$H" --mercado usdm_futures "$L/c1_dia1" "$L/c1_dia2" > "$L/c1.json" 2>&1
rc1=$?
"$PY" -c "
import json;d=json.load(open('$L/c1.json'))
print('  certification:', d['certification'])
for c in d['costuras']: print('  costura: ultimo',c['ultimo_ingest_seq'],'-> primero',c['primer_ingest_seq'],'| hueco',c['hueco'],'| pass',c['pass'])
print('  errores:', d['errores'])
print('  sesiones:', d['capture_session_ids'], '| esquemas:', d['schema_versions'])
" 2>&1 | head -12
echo "  codigo de salida: $rc1   (DEBE SER 0)"

echo
echo "############ CASO 2: falta un segmento entero (DEBE SUSPENDER) ############"
enlazar2 "$L/c2_dia1" "${F[@]:0:5}"
enlazar2 "$L/c2_dia2" "${F[@]:6:4}"     # se salta el sexto
"$PY" "$H" --mercado usdm_futures "$L/c2_dia1" "$L/c2_dia2" > "$L/c2.json" 2>&1
rc2=$?
"$PY" -c "
import json;d=json.load(open('$L/c2.json'))
print('  certification:', d['certification'])
for c in d['costuras']: print('  costura: hueco de', c['hueco'], 'eventos')
for e in d['errores']: print('  ERROR DETECTADO:', e)
" 2>&1 | head -8
echo "  codigo de salida: $rc2   (DEBE SER 2)"

echo
echo "############ CASO 3: solapamiento (DEBE SUSPENDER) ############"
enlazar2 "$L/c3_dia1" "${F[@]:0:6}"
enlazar2 "$L/c3_dia2" "${F[@]:5:5}"     # el sexto esta en los dos
"$PY" "$H" --mercado usdm_futures "$L/c3_dia1" "$L/c3_dia2" > "$L/c3.json" 2>&1
rc3=$?
"$PY" -c "
import json;d=json.load(open('$L/c3.json'))
print('  certification:', d['certification'])
for c in d['costuras']: print('  costura: hueco', c['hueco'], '(negativo = solapamiento)')
for e in d['errores']: print('  ERROR DETECTADO:', e)
" 2>&1 | head -8
echo "  codigo de salida: $rc3   (DEBE SER 2)"

echo
echo "############ VEREDICTO ############"
if [ "$rc1" = "0" ] && [ "$rc2" = "2" ] && [ "$rc3" = "2" ]; then
  echo "  LA HERRAMIENTA SIRVE: aprueba lo continuo y suspende hueco y solapamiento"
else
  echo "  *** NO SIRVE *** rc1=$rc1 (esperado 0) rc2=$rc2 (esperado 2) rc3=$rc3 (esperado 2)"
  echo "  --- salida del caso 1 ---"; head -30 "$L/c1.json"
fi
echo "PC_CONT_OK"
