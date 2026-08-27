#!/usr/bin/env bash
# REVISION del conversor escrito por Gemini. Este programa borra datos:
# se revisa antes de dejarlo acercarse a nada que importe.
set +e
H=/home/trading/jean-flow-exec/herramientas/convertir_parquet.py
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python

echo "=== 1) ¿existe y compila? ==="
ls -la "$H" 2>&1
"$PY" -m py_compile "$H" 2>&1 && echo "COMPILA" || echo "NO COMPILA"
echo "lineas: $(wc -l < "$H" 2>/dev/null)"

echo
echo "=== 2) las cinco salvaguardas, una por una ==="
chk() { if grep -q "$2" "$H"; then echo "  $1: PRESENTE"; else echo "  $1: ***AUSENTE***"; fi; }
chk "S1 aborta si hay captura activa" 'binance_collector\[\.\]dual_main'
chk "S2 solo bajo staging_runs"       'staging_runs'
chk "S2 usa realpath"                 'realpath'
chk "S4 solo borra .csv"              '\.csv'
chk "S5 comprueba espacio libre"      'disk_usage'
chk "manifiesto atomico"              'os.replace'
chk "verifica igualdad de tablas"     '\.equals('
chk "borrado solo con la bandera"     'borrar'

echo
echo "=== 3) LO MAS IMPORTANTE: donde borra, y que lo protege ==="
grep -n 'os.remove\|os.unlink\|\.unlink()' "$H"
echo "--- contexto de cada borrado (5 lineas antes) ---"
for L in $(grep -n 'os.remove\|os.unlink' "$H" | cut -d: -f1); do
  echo "  --- linea $L ---"
  sed -n "$((L>5?L-5:1)),${L}p" "$H" | sed 's/^/    /'
done

echo
echo "=== 4) ¿por defecto borra? (la respuesta debe ser NO) ==="
grep -n 'add_argument("--borrar"\|add_argument(.--borrar' "$H"
echo "PREVIA_OK"
