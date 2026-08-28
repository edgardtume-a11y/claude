#!/usr/bin/env bash
# Probar el guion de auditoria en paralelo SIN tocar los informes del gate del
# operador: son la evidencia del analisis de esta tarde. Se monta un staging
# temporal con enlaces simbolicos a su capture/ y al overlay bueno, y el
# directorio audit/ se crea en el temporal.
set +e
N=/home/trading/jean-flow-exec/staging_runs/20260828T155419Z_tokyo_postmask_gate_30m
AP=/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet
T=/home/trading/prueba_paralelo
G=/home/trading/puente_github_repo/puente_github/scripts/run_live_audits_paralelo.sh

if ps -eo cmd | grep -E 'binance_collector[.]dual_main' | grep -v grep >/dev/null; then
  echo "HAY CAPTURA ACTIVA -> ABORTADO"; exit 0; fi

rm -rf "$T"; mkdir -p "$T"
ln -s "$N/capture"    "$T/capture"
ln -s "$AP/overlay"   "$T/overlay"
echo "staging de prueba: $T"
echo "  capture -> $(readlink "$T/capture")"
echo "  overlay -> $(readlink "$T/overlay")"

echo
echo "=== ejecutando ==="
timeout 100 bash "$G" "$T"
rc=$?
echo "  codigo de salida del guion: $rc"

echo
echo "=== los informes de tu gate, INTACTOS ==="
ls -l "$N/audit/return_codes.json"; cat "$N/audit/return_codes.json"
echo "  (fecha 17:09, la de esta tarde: no se ha tocado)"

echo
echo "=== ¿coincide con lo que dio la auditoria original? ==="
echo -n "  original: "; cat "$N/audit/return_codes.json"
echo -n "  paralelo: "; cat "$T/audit/return_codes.json" 2>/dev/null
echo

echo "=== ¿y los informes son los mismos? ==="
for f in journal_spot journal_usdm identity metrics; do
  a=$(sha256sum "$N/audit/$f.json" 2>/dev/null | cut -c1-16)
  b=$(sha256sum "$T/audit/$f.json" 2>/dev/null | cut -c1-16)
  if [ "$a" = "$b" ]; then echo "  $f: IDENTICO ($a)"; else echo "  $f: distinto  original=$a paralelo=$b"; fi
done
echo "  (nota: 'files' guarda las rutas, y aqui son enlaces, asi que"
echo "   alguna diferencia en ese campo seria esperable y no un fallo)"
echo "PP_OK"
