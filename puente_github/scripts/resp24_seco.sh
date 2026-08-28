#!/usr/bin/env bash
# Simulacro del respaldo del 24 en adelante: cuenta y mide, no escribe nada.
set +e
/usr/bin/python3 /home/trading/puente_github_repo/puente_github/scripts/respaldo_total_obrero.py \
  --desde 2026-08-24 --dry-run 2>&1 | tail -40
