#!/usr/bin/env bash
# Limpieza del revisor: retirar pruebas fantasma de gates anteriores que venían
# arrastradas en el overlay (referencian sesiones/raíces antiguas).
set -e
RUN=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
cd "$RUN/overlay/tests"
ls -1 *.py
rm -f test_30m_gate.py test_2h_gate.py test_45m_gate.py test_6h_gate.py
echo --- despues ---
ls -1 *.py
echo LIMPIEZA_OK
