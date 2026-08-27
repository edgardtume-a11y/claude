#!/usr/bin/env bash
# Preparación del primer gate de 30 min en Tokio (ejecutado 27/08/2026 07:52 UTC).
# Instanciación paramétrica del gate 45m v2 ACEPTADO (raíz/sesión/duración vía sed),
# sin autoría nueva; la suite completa re-verifica (10/10 en Tokio).
set -e
BASE=/home/trading/jean-flow-exec/staging_runs
G45=$BASE/20260827T040839Z_continuous_capture_gate45_45m
TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN=$BASE/${TS}_tokyo_capture_gate1_30m
SID=$(python3 -c "import uuid;print(uuid.uuid4().hex)")
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
mkdir -p "$RUN/control" "$RUN/audit" "$RUN/capture"
cp -a "$G45/overlay" "$RUN/"
rm -rf "$RUN/overlay/tests/__pycache__" "$RUN/overlay/.pytest_cache"
cp "$G45/control/hb_feed.py" "$G45/control/probe.py" "$RUN/control/"
sed -e "s|$G45|$RUN|g" -e "s|SESSION_ID_45M|$SID|g" -e "s|--healthy-seconds 2700|--healthy-seconds 1800|" "$G45/control/launch_live.sh" > "$RUN/control/launch_live.sh"
chmod 0755 "$RUN/control/launch_live.sh"
sed -e "s|$G45|$RUN|g" "$G45/control/run_live_audits.sh" > "$RUN/control/run_live_audits.sh"
chmod 0755 "$RUN/control/run_live_audits.sh"
sed -e "s|SESSION_ID_45M|$SID|g" -e "s|2700|1800|g" -e "s|2830.0|1930.0|g" "$G45/overlay/tests/test_45m_gate.py" > "$RUN/overlay/tests/test_tokyo30_gate.py"
rm -f "$RUN/overlay/tests/test_45m_gate.py"
chmod 0644 "$RUN/overlay/tests/test_tokyo30_gate.py"
bash -n "$RUN/control/launch_live.sh"
cd "$RUN" && PYTHONPATH=overlay/src "$PY" -m pytest overlay/tests/test_tokyo30_gate.py overlay/tests/test_dual_orchestration_qa.py
