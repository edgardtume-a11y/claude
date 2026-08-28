#!/usr/bin/env bash
# LA PREGUNTA QUE DECIDE EL PLAN DE 7 DIAS:
# el rotador borra los CSV segun los comprime. El auditor recibe rutas de CSV.
# Si el auditor NO sabe leer Parquet, al acabar los 7 dias no habria nada que
# certificar: el dato estaria a salvo, pero la certificacion seria imposible
# sin reconstruir 628 GiB de CSV.
set +e
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== 1) ¿audit.py sabe de Parquet? ==="
grep -n -icE 'parquet|pyarrow|pq\.' "$B/audit.py" | sed 's/^/  menciones: /'
grep -n -iE 'parquet|pyarrow' "$B/audit.py" | head -10 || echo "  NINGUNA -> solo lee CSV"

echo
echo "=== 2) ¿como abre los ficheros? ==="
grep -n -iE 'open\(|csv.reader|DictReader|read_text|Path\(.*\)\.open' "$B/audit.py" | head -12

echo
echo "=== 3) los tres subcomandos y que recibe cada uno ==="
sed -n '1235,1300p' "$B/audit.py"

echo
echo "=== 4) ¿existe el reconstructor y donde? ==="
ls -l /home/trading/puente_github_repo/puente_github/scripts/reconstruir_csv.py 2>/dev/null
ls -l /home/trading/jean-flow-exec/herramientas/*.py 2>/dev/null

echo
echo "=== 5) ¿como llama el guardian al auditor? ==="
grep -n -A30 'def do_auditar' /home/trading/puente_github_watcher.py | head -40
echo "APQ_OK"
