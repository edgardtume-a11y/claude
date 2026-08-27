#!/usr/bin/env bash
# Parada LIMPIA del gate 3 por orden del operador (27/08/2026).
# Escribe el contrato STOP.json que el motor valida (capture_session_id +
# requested_by_pid=launcher + requested_utc_ns + reason=launcher_shutdown).
# NO mata procesos: el motor cierra sus archivos ordenadamente.
set -e
R=/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
python3 - <<'PYEOF'
import json, os, time, tempfile
R = "/home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h"
ses = json.load(open(f"{R}/control/session.json"))
ident = ses.get("identity", ses)
payload = {
    "capture_session_id": ident["capture_session_id"],
    "requested_by_pid": ident["launcher_pid"],
    "requested_utc_ns": time.time_ns(),
    "reason": "launcher_shutdown",
}
assert payload["requested_utc_ns"] > ident["process_start_utc_ns"], "timestamp invalido"
dst = f"{R}/control/STOP.json"
fd, tmp = tempfile.mkstemp(dir=f"{R}/control", prefix="STOP.", suffix=".partial")
with os.fdopen(fd, "w") as fh:
    json.dump(payload, fh, sort_keys=True)
    fh.flush()
    os.fsync(fh.fileno())
os.replace(tmp, dst)
print("STOP escrito:", json.dumps(payload, sort_keys=True))
PYEOF
echo "=== esperando cierre ordenado ==="
for i in $(seq 1 30); do
  if ! pgrep -f 'binance_collector[.]dual_main' >/dev/null; then
    echo "MOTOR CERRADO tras ${i}0 s"
    break
  fi
  sleep 10
done
echo "=== ULTIMAS LINEAS DEL LAUNCHER ==="
tail -3 "$R/launcher_console.log"
echo "=== PARCIALES ==="
find "$R/capture" -name '*partial*' 2>/dev/null | wc -l
echo DETENCION_OK
