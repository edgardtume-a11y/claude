#!/usr/bin/env bash
# ¿Que queda por hacer para bajar mas la latencia? Radiografia del camino caliente.
# Lo importante al final: el puente solo devuelve los ultimos 4000 caracteres.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector
[ -d "$SRC" ] || SRC=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/overlay/src/binance_collector
echo "fuente: $SRC"

echo
echo "=== 1) afinidad de CPU: se usa? ==="
grep -rn 'sched_setaffinity\|taskset\|cpu_affinity\|SCHED_FIFO\|setpriority\|nice(' "$SRC"/*.py | head
echo "(vacio = no se usa)"

echo
echo "=== 2) opciones de socket TCP ==="
grep -rn 'TCP_NODELAY\|SO_RCVBUF\|SO_SNDBUF\|setsockopt\|tcp_nodelay' "$SRC"/*.py | head
echo "(vacio = se usan los valores por defecto)"

echo
echo "=== 3) compresion del websocket ==="
grep -rn 'compression\|permessage\|deflate\|max_size\|read_limit' "$SRC"/collector.py | head

echo
echo "=== 4) LO MAS IMPORTANTE: que libreria decodifica el JSON de Binance ==="
grep -rn '^import json\|^import orjson\|^import ujson\|import msgspec\|json.loads\|orjson.loads' "$SRC"/*.py | head -20
echo "--- cuantas veces se llama a json.loads en el camino caliente ---"
grep -c 'json.loads' "$SRC"/collector.py 2>/dev/null
echo "--- estan instaladas las alternativas rapidas? ---"
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python -c "
for m in ('orjson','ujson','msgspec'):
    try:
        mod=__import__(m); print(f'  {m}: INSTALADO', getattr(mod,'__version__','?'))
    except ImportError:
        print(f'  {m}: no instalado')
"
echo "INVESTIGAR_OK"
