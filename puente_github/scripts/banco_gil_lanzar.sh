#!/usr/bin/env bash
# Lanza el banco de pruebas del GIL en segundo plano y devuelve enseguida.
#
# El fichero lo escribio Gemini pero su ejecucion nunca llego a completarse.
# Ahora el fichero ya es legible por 'trading', asi que el revisor puede
# rematar el trabajo desde su lado: escribir el banco era lo caro, correrlo no.
#
# En segundo plano por la regla de operaciones/LECCION_PUENTE_SERIAL.md:
# ninguna orden del puente debe quedarse esperando.
set +e
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
B=/home/trading/jean-flow-exec/herramientas/banco_gil.py
LOG=/home/trading/banco_gil.log

echo "=== ¿que parametros acepta? ==="
timeout 30 "$PY" "$B" --help 2>&1 | head -30

echo
echo "=== cabecera del fichero (para saber que mide) ==="
head -25 "$B" 2>&1

echo
if pgrep -f 'banco_gil[.]py' >/dev/null; then
  echo "YA SE ESTA EJECUTANDO - no se lanza otro"
  tail -20 "$LOG" 2>/dev/null
  echo "LANZAR_BANCO_OK"
  exit 0
fi

if pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
  echo "HAY UNA CAPTURA ACTIVA - no se lanza el banco para no falsear la medida"
  exit 1
fi

nohup "$PY" "$B" > "$LOG" 2>&1 &
echo "banco lanzado, pid=$!"
echo "registro: $LOG"
echo "LANZAR_BANCO_OK"
