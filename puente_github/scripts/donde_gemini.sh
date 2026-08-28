#!/usr/bin/env bash
set +e
echo "=== acciones que acepta el guardian ==="
grep -n -iE "accion ==|acciones|ACCIONES_|elif a ==|'gemini" /home/trading/puente_github_watcher.py | head -30
echo
echo "=== donde guarda el runner sus trabajos ==="
grep -n -iE 'JOBS|jobs_dir|STATE|DB|sqlite|\.json|Path\(|os.path.join' /opt/jean-flow-gemini/lib/gemini_job_runner.py | head -30
echo
echo "=== ficheros abiertos por el runner ==="
ls -l /proc/649/cwd 2>/dev/null
ls -l /proc/649/fd 2>/dev/null | grep -v 'socket\|pipe\|/dev' | head -15
echo "DONDE_OK"
