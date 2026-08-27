#!/usr/bin/env bash
# Preparación del staging del Gate 3 (2 horas, máquina n2 dedicada).
# Instanciación paramétrica desde el gate 2 ACEPTADO (revisor prepara terreno y
# pruebas; los archivos de control los escribirá Gemini bajo contrato).
set -e
BASE=/home/trading/jean-flow-exec/staging_runs
G2=$BASE/20260827T123816Z_tokyo12_capture_gate2_30m
TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN=$BASE/${TS}_tokyo_n2_capture_gate3_2h
SID=$(python3 -c "import uuid;print(uuid.uuid4().hex)")
OLD_SID=$(grep -oE '[0-9a-f]{32}' "$G2/overlay/tests/test_tokyo30_gate.py" | head -1)
mkdir -p "$RUN/control" "$RUN/audit" "$RUN/capture"
tar -C "$G2" --exclude='__pycache__' --exclude='.pytest_cache' -cf - overlay | tar -C "$RUN" -xf -
cp "$G2/control/hb_feed.py" "$G2/control/probe.py" "$RUN/control/"
sed -i -e "s|$G2|$RUN|g" -e "s|$OLD_SID|$SID|g" -e "s|1930\.0|7330.0|g" -e "s|1800|7200|g" "$RUN/overlay/tests/test_tokyo30_gate.py"
mv "$RUN/overlay/tests/test_tokyo30_gate.py" "$RUN/overlay/tests/test_gate3_2h.py"
echo "$RUN" > /tmp/gate3_root.txt
echo "$SID" > /tmp/gate3_sid.txt
echo "RUN=$RUN"
echo "SID=$SID"
echo "OLD_SID=$OLD_SID"
echo "PREP_GATE3_OK"
