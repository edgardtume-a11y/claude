#!/usr/bin/env bash
# ¿Llego Gemini a escribir el banco de pruebas del GIL?
# Si el encargo agota su tiempo pero el fichero esta ahi y compila, el revisor
# puede ejecutarlo el mismo: escribir el banco es el trabajo caro, correrlo no.
set +e
B=/home/trading/jean-flow-exec/herramientas/banco_gil.py
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

echo "=== ¿existe? ==="
ls -la "$B" 2>&1
[ -f "$B" ] || { echo "TODAVIA_NO_ESCRITO"; exit 0; }

echo "lineas: $(wc -l < "$B")"
echo
echo "=== ¿compila? ==="
"$PY" -m py_compile "$B" && echo COMPILA || echo "NO COMPILA"

echo
echo "=== interfaz: que parametros acepta ==="
grep -n 'add_argument\|def main\|E0\|E1\|E2\|E3\|escenario' "$B" | head -25

echo
echo "=== ¿toca algo que no deba? ==="
grep -n 'staging_runs\|os.remove\|shutil.rmtree\|binance_collector' "$B" | head
echo "(vacio arriba = no se acerca a las capturas)"
echo "VER_BANCO_OK"
