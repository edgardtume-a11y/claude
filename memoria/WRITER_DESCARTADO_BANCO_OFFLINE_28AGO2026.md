# El writer queda descartado: aporta 1.3 ms sea cual sea la carga

28/08/2026 · banco offline, sin red, sin datos productivos · `herramientas/barrido_gil.py`

## Qué se probaba

Del análisis de correlación salió la hipótesis de que, bajo ráfaga de trades, el
writer procesa más filas por lote y compite por el GIL con el loop de asyncio,
alargando la cola. **Se refuta.**

Instrumento: `_benchmark_writer_lag` del banco del worktree — sondeo del loop
cada 1 ms mientras el writer escribe un lote. Python 3.12.3, aiohttp 3.14.3,
uvloop 0.22.1, intérprete del release. Cinco repeticiones por punto, mediana.

## A — barrido de `write_chunk_rows`, 10 000 filas

| chunk_rows | lag p50 | lag p99 | lag max |
|---|---|---|---|
| 8 | 0.552 | 1.094 | 1.202 |
| 32 | 0.583 | 1.353 | 1.421 |
| **64 (producción)** | **0.608** | **1.274** | 1.568 |
| 256 | 1.061 | 3.282 | 3.336 |
| 1024 | 2.016 | 8.374 | 9.938 |
| 4096 | 3.265 | 12.787 | 13.170 |
| 16384 | 3.458 | 13.387 | 14.668 |

El mecanismo del GIL existe y es fuerte: **p99 ×12** entre los extremos.

## B — barrido de carga con chunk fijo en 64

| filas | lag p50 | lag p99 |
|---|---|---|
| 500 | 0.531 | 1.073 |
| 2 000 | 0.540 | 1.247 |
| 10 000 | 0.604 | 1.268 |
| 40 000 | 0.641 | **1.314** |

**Ochenta veces más filas suben el p99 un 22 %.**

## D — la interacción, que es lo decisivo

| filas | chunk | lag p99 |
|---|---|---|
| 2 000 | 64 | 1.218 |
| 2 000 | 4096 | 5.654 |
| 40 000 | **64** | **1.267** |
| 40 000 | 4096 | 14.819 |

**El chunk es la compuerta.** Con 64 la carga no pasa (+4 % con 20× más filas);
con 4096 sí pasa (×2.6).

## C — el tiempo de cesión no es palanca

`yield_sleep_s` de 0.0001 a 0.008 — 80× de rango — deja el p99 entre 1.09 y
1.70 ms, sin tendencia.

## Conclusión

Producción usa `writer_chunk_rows = 64` (`config.py:81` y `:133`, vía
`WRITER_CHUNK_ROWS`). El `write_chunk_rows=1` que aparece en el árbol es de
`tests/test_low_latency.py:89`, no de configuración.

A ese ajuste **el writer aporta ~1.3 ms con independencia de la carga**. No puede
producir los 584 ms del peor caso ni los 26 ms de mediana del max por ventana.

La correlación con trades medida en producción (`agg_trade_messages` ×4.23,
`writer_gil_yields` ×3.07 en las peores ventanas) es real pero **no causal por
esta vía**: el writer cede más veces porque hay más filas, no porque eso alargue
el loop. `writer_gil_yields` era acompañante, no mecanismo.

**Dónde sigue el trabajo:** la ruta previa al writer — recepción, parseo y
despacho de trades.

## Hallazgo de configuración con medición detrás

`config.py:270` rechaza `WRITER_CHUNK_ROWS > 1024`. **El tope está demasiado
alto:** 1024 ya da p99 de 8.37 ms y 256 da 3.28 ms, frente a 1.27 ms en 64.

Propuesta: bajar el tope a **128**. Preserva el margen medido y hace imposible
una regresión de configuración que multiplicaría el lag por seis sin que ninguna
prueba fallara. Una línea, con número detrás.

**No aplicado**: es el árbol que mantiene ChatGPT.

## Debilidades reconocidas de este barrido

No usa secuencia determinista con semilla y hash, no alterna el orden entre
repeticiones, y no registra CPU ni pausas de GC. Las tres las incorpora la
especificación que propuso ChatGPT y deben añadirse antes de tratar esto como
evidencia de certificación.
