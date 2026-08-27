#!/usr/bin/env bash
# Prepara el staging del gate 4 (30 min) donde se aplicarán las mejoras M1/M2/M3.
# El overlay es una COPIA aislada: el motor certificado original nunca se toca.
set -e
BASE=/home/trading/jean-flow-exec/staging_runs
G3=$BASE/20260827T143004Z_tokyo_n2_capture_gate3_2h
TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN=$BASE/${TS}_tokyo_n2_gate4_mejoras_30m
SID=$(python3 -c "import uuid;print(uuid.uuid4().hex)")
OLD_SID=c37b7c55fca84a6cb08afb8bb43d1a08
mkdir -p "$RUN/control" "$RUN/audit" "$RUN/capture"
tar -C "$G3" --exclude='__pycache__' --exclude='.pytest_cache' -cf - overlay | tar -C "$RUN" -xf -
cp "$G3/control/hb_feed.py" "$G3/control/probe.py" "$RUN/control/"
sed -e "s|$G3|$RUN|g" -e "s|$OLD_SID|$SID|g" -e "s|--healthy-seconds 7200|--healthy-seconds 1800|" "$G3/control/launch_live.sh" > "$RUN/control/launch_live.sh"
chmod 0755 "$RUN/control/launch_live.sh"
sed -e "s|$G3|$RUN|g" "$G3/control/run_live_audits.sh" > "$RUN/control/run_live_audits.sh"
chmod 0755 "$RUN/control/run_live_audits.sh"
sed -i -e "s|$G3|$RUN|g" -e "s|$OLD_SID|$SID|g" -e "s|7200|1800|g" -e "s|7330\.0|1930.0|g" "$RUN/overlay/tests/test_gate3_2h.py"
mv "$RUN/overlay/tests/test_gate3_2h.py" "$RUN/overlay/tests/test_gate4_mejoras.py"
bash -n "$RUN/control/launch_live.sh"
echo "RUN=$RUN"
echo "SID=$SID"
ls -1 "$RUN/overlay/tests/"
echo PREP_GATE4_OK
