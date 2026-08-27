#!/usr/bin/env bash
# Copia parquet_store.py a un .txt bajo staging_runs para poder leerlo entero
# de una vez con la accion leer_archivo (100 KB), en vez de a trozos de 4000
# caracteres. El original no se toca.
set +e
SRC=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src/binance_collector/parquet_store.py
DST=/home/trading/jean-flow-exec/staging_runs/20260827T195636Z_tokyo_n2_gate4_mejoras_30m/parquet_store_lectura.txt

if [ ! -f "$SRC" ]; then
  echo "no existe $SRC"
  exit 1
fi

cp "$SRC" "$DST"
echo "copiado: $DST"
echo "bytes: $(stat -c%s "$DST")"
echo "lineas: $(wc -l < "$DST")"
echo "EXPONER_OK"
