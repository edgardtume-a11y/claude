#!/usr/bin/env bash
# HALLAZGO: un resultado del puente llego con fecha del 27 y sin el campo
# 'estado'. El guardian que yo conozco siempre pone 'estado'. Hay un SEGUNDO
# proceso contestando la misma cola de ordenes.
# Dos procesos escribiendo el mismo directorio de resultados es una carrera:
# el que llega ultimo gana, y yo leo lo que gane. Eso ya me dio una captura
# activa fantasma y un disco que no era el real.
set +e
E=/home/trading/import_backup/JEAN_FLOW_UNRESTRICTED/bridge/PUENTE_CARPETA_IA_engine.py

echo "=== 1) el proceso, con su linea de ordenes entera ==="
ps -eo pid,user,lstart,etime,cmd | grep -i 'PUENTE_CARPETA_IA_engine' | grep -v grep

echo
echo "=== 2) ¿escribe en el MISMO sitio que el guardian? ==="
grep -n -iE 'ordenes|resultados|RESULTS|ORDERS|REPO_DIR|_DIR *=|Path\(' "$E" 2>/dev/null | head -20

echo
echo "=== 3) ¿pone el campo 'estado'? ¿y de donde saca procesado_utc? ==="
grep -n -iE 'estado|procesado_utc|utcnow|datetime|strftime' "$E" 2>/dev/null | head -15

echo
echo "=== 4) ¿es un servicio? ¿quien lo arranco? ==="
systemctl list-units --type=service --all 2>/dev/null | grep -iE 'puente|carpeta|jean' | head -10
cat /proc/1048/cmdline 2>/dev/null | tr '\0' ' '; echo
ls -l /proc/1048/cwd 2>/dev/null

echo
echo "=== 5) ¿cuantos resultados ha escrito EL SIN 'estado'? ==="
R=/home/trading/puente_github_repo/puente_github/resultados
python3 - <<'PY'
import json, os, glob
R="/home/trading/puente_github_repo/puente_github/resultados"
sin=[]; con=0
for f in sorted(glob.glob(os.path.join(R,"*.json"))):
    try: d=json.load(open(f))
    except Exception: continue
    if "estado" in d: con+=1
    else: sin.append((os.path.basename(f), d.get("procesado_utc")))
print("  con 'estado':", con)
print("  SIN 'estado':", len(sin))
for n,t in sin[-15:]: print("    ", n, t)
PY
echo "DP_OK"
