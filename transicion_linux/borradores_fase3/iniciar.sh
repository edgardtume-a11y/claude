#!/usr/bin/env bash
# BORRADOR FASE 3, NO ACTIVADO — Punto de entrada ÚNICO de JEAN_FLOW 555 en Linux.
#
# Sustituye a los cinco puntos de entrada de doble clic de Windows
# (INICIAR.cmd, CERTIFICAR_BTCUSDT.cmd, ARREGLAR_RELOJ.cmd,
# RECOGER_EVIDENCIA_TODO.cmd, INSTALAR_EN_C_v241.cmd), cuatro de los cuales
# viven hoy fuera del paquete sellado. DECISIÓN DEL PROYECTO: en Linux hay un
# solo punto de entrada, dentro del paquete y dentro del manifiesto.
#
# Contrato heredado del protocolo (PROTOCOLO_JEAN_FLOW_v2.4.1.txt) que este
# script preserva: rechazo de privilegios (fallo cerrado), Python 3.12 por
# rutas FIJAS (nunca aliases del PATH), motor con -I -S -B -u, runs/ como
# evidencia intocable (el recogedor SOLO lee), y ningún umbral tocado.
#
# Uso:
#   ./iniciar.sh                     Menú supervisado (equivale a INICIAR.cmd)
#   ./iniciar.sh certificar [SIMB]   Certificación modo 3 completa, símbolo
#                                    BTCUSDT por defecto (= CERTIFICAR_BTCUSDT.cmd)
#   ./iniciar.sh reloj               Estado del reloj según chronyd, JSON legible
#                                    por máquina (ARREGLAR_RELOJ.cmd desaparece:
#                                    chronyd disciplina solo, sin UAC y sin clics)
#   ./iniciar.sh evidencia           Recoge SOLO informes (.json .jsonl .txt .log
#                                    .md, ≤100 MB por archivo, jamás CSV de datos)
#                                    de todas las carpetas runs/, incluidas las
#                                    555_anterior_* (= RECOGER_EVIDENCIA_TODO.cmd)
#   ./iniciar.sh verificar           Integridad del árbol (144 sellos) + batería
#                                    de pruebas offline

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

COLECTOR="binance_phase1_collector"

# --- Cero privilegios, fallo cerrado (equivalente de TokenElevation/UAC) ---
if [ "$(id -u)" -eq 0 ]; then
  echo "============================================================"
  echo "CONSOLA_ELEVADA: no ejecutes esto como root ni con sudo."
  echo "Vuelve a lanzarlo como tu usuario normal. Nada fue iniciado."
  echo "============================================================"
  exit 3
fi

# --- Python 3.12 exacto por rutas FIJAS, como exige el LEEME (nunca PATH) ---
buscar_python() {
  for cand in /usr/bin/python3.12 /usr/local/bin/python3.12 /opt/python3.12/bin/python3.12; do
    if [ -x "$cand" ]; then
      if "$cand" -I -S -B -c 'import struct,sys;raise SystemExit(0 if sys.version_info[:2]==(3,12) and struct.calcsize("P")==8 else 1)' >/dev/null 2>&1; then
        echo "$cand"; return 0
      fi
    fi
  done
  return 1
}

PY="$(buscar_python)" || {
  echo "============================================================"
  echo "BOOTSTRAP_FAILED: no se encontró Python 3.12 x64 en las rutas"
  echo "oficiales (/usr/bin, /usr/local/bin, /opt/python3.12/bin)."
  echo "Instálalo con el gestor de tu distribución y vuelve a ejecutar."
  echo "No se inició ningún proceso ni se modificó el reloj."
  echo "============================================================"
  exit 2
}

caso="${1:-menu}"

case "$caso" in
  menu)
    exec "$PY" -I -S -B -u jean_flow_launcher.py
    ;;

  certificar)
    simbolo="${2:-BTCUSDT}"
    echo "============================================================"
    echo " CERTIFICACIÓN COMPLETA (modo 3: 10 + 30 + 120 min)"
    echo " Símbolo: $simbolo"
    echo " Antes de seguir: equipo enchufado, sin programas pesados,"
    echo " sin suspensión. A partir de aquí: manos fuera ~3 horas."
    echo "============================================================"
    # systemd-inhibit sustituye a la regla de Windows de vigilar la suspensión;
    # si no está disponible, se ejecuta igual (el gate de salud lo detectaría).
    if command -v systemd-inhibit >/dev/null 2>&1; then
      exec systemd-inhibit --what=sleep:idle --why="Certificacion JEAN_FLOW 555" \
        "$PY" -I -S -B -u jean_flow_launcher.py --mode full --symbol "$simbolo"
    fi
    exec "$PY" -I -S -B -u jean_flow_launcher.py --mode full --symbol "$simbolo"
    ;;

  reloj)
    # Solo LEE el estado; jamás ajusta el reloj (eso es de chronyd y de nadie
    # más). Falla cerrado si chronyd no corre o no está sincronizado.
    exec "$PY" -I -S -B -u "$(dirname "$(readlink -f "$0")")/lector_chrony.py" --warn-ms 50.0
    ;;

  evidencia)
    # Política heredada de RECOGER_EVIDENCIA_TODO.cmd: SOLO lee y copia
    # informes; jamás modifica, renombra ni borra nada; nunca CSV de datos;
    # nada mayor de 100 MB; busca TODAS las carpetas runs/ cuyo padre sea
    # binance_phase1_collector, incluidas las 555_anterior_*.
    marca="$(date -u +%Y%m%dT%H%M%SZ)"
    destino="${HOME}/EVIDENCIA_PARA_CLAUDE_TODO_${marca}.tar.gz"
    raiz="$(cd .. && pwd)"
    lista="$(mktemp)"
    find "$raiz" -maxdepth 8 -type d -name runs \
        -path "*/binance_phase1_collector/runs" 2>/dev/null | while read -r rdir; do
      find "$rdir" -type f \( -name '*.json' -o -name '*.jsonl' -o -name '*.txt' \
        -o -name '*.log' -o -name '*.md' \) -size -100M -print
    done > "$lista"
    if [ ! -s "$lista" ]; then
      echo "No se encontró ninguna carpeta runs/ con informes: nada que recoger."
      rm -f "$lista"; exit 1
    fi
    tar -czf "$destino" --files-from="$lista" -P
    rm -f "$lista"
    sha256sum "$destino" | tee "${destino}.sha256"
    echo "Evidencia empaquetada en: $destino"
    echo "Sube ese archivo (y su .sha256) al chat."
    ;;

  verificar)
    echo "== Integridad del árbol (RELEASE_MANIFEST.sha256) =="
    ( cd .. && sha256sum --quiet -c 555/RELEASE_MANIFEST.sha256 ) \
      && echo "Sellos: OK" || { echo "SELLOS ROTOS: árbol adulterado."; exit 1; }
    echo "== Batería de pruebas offline =="
    ( cd "$COLECTOR" && PYTHONPATH=src "$PY" -m pytest tests/ )
    ;;

  *)
    echo "Subcomando desconocido: $caso"
    echo "Usa: (nada) | certificar [SIMBOLO] | reloj | evidencia | verificar"
    exit 64
    ;;
esac
