#!/usr/bin/env bash
# ¿Como se lanza la auditoria hoy? Tarda ~17 min porque hace spot y futuros
# uno detras de otro. Si son independientes, se pueden hacer a la vez: la
# maquina tiene 8 nucleos y usa uno.
# OJO: audit.py esta certificado. No se toca. Si se paraleliza, es POR FUERA.
set +e
B=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector

echo "=== como lo invoca el guardian ==="
grep -n -A25 'auditar_staging' /home/trading/puente_github_watcher.py | head -40

echo
echo "=== la CLI del auditor ==="
grep -n 'add_argument' "$B/audit.py" | head -20

echo
echo "=== ¿procesa los dos mercados en el mismo proceso? ==="
grep -n -iE 'spot|usdm_futures|for market|markets' "$B/audit.py" | head -25

echo
echo "=== ¿escribe un informe por mercado o uno solo? ==="
grep -n -iE 'json.dump|informe|report|salida|output' "$B/audit.py" | head -15
echo "AUD_OK"
