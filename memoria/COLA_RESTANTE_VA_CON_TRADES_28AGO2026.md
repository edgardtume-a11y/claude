# La cola que queda no es del sistema: va con los trades

28/08/2026 · gate post-máscara, 691 ventanas no solapadas · `herramientas/carga_vs_cola.py`

## Contexto

Quitada la cadena de Ubuntu Pro, los atascos periódicos desaparecieron y lo que
queda **no tiene firma de reloj**: 71 sucesos >60 ms en una hora, separaciones de
mediana 21 s y desviación 70 s, sin encajar con ningún período (60, 120, 300,
600 ni 900 s encajan mejor que el azar).

Agotada la vía "qué servicio del sistema interrumpe", la hipótesis restante era
acoplamiento con la carga. Se confirma, y señala dentro del colector.

## El resultado

Contadores diferenciados entre publicaciones, Spearman sobre rangos, y contraste
de las 20 peores contra las 20 mejores ventanas por `max`:

| regresor | CV | rho vs max | 20 mejores | 20 peores | ratio |
|---|---|---|---|---|---|
| `agg_trade_messages` | 0.93 | +0.413 | 130 | 552 | **4.23×** |
| `writer_gil_yields` | 0.57 | +0.405 | 92 | 282 | **3.07×** |
| `websocket_messages` | 0.74 | +0.415 | 228 | 656 | 2.87× |
| `websocket_bytes` | 0.49 | +0.423 | 240 600 | 562 762 | 2.34× |
| `csv_rows_written` | 0.46 | +0.405 | 9 620 | 22 214 | 2.31× |
| `depth_diff_messages` | **0.03** | +0.554 | 49 | 51 | **1.04×** |
| `depth_applied_events` | **0.06** | +0.507 | 49 | 51 | **1.04×** |
| `csv_flushes` | 0.05 | −0.286 | 19 | 18 | 0.95× |

## La trampa de esta tabla

`depth_diff_messages` tiene **el rho más alto** (+0.554) y es **el regresor menos
relevante**. Su CV es 0.03: el caudal de depth es plano (49 vs 51 mensajes). Un
rho alto sobre una variable que no varía describe ruido ordenado, no efecto.

**Hay que leer rho y tamaño de efecto juntos, nunca rho solo.** Es el mismo error
que se cometió en el turno 022 al tomar la mediana de un máximo como línea base.

## Lo que dicen los datos

El caudal de **depth es plano**; el de **trades varía casi 1:1** y se multiplica
por **4.23** en las peores ventanas. Los tirones no llegan cuando hay más libro:
llegan cuando hay más **operaciones**.

El acompañante más informativo es `writer_gil_yields`: **×3.07**, con 2.31× filas
escritas. `csv_flushes` es plano y su rho es **negativo**: no son los volcados a
disco.

**Hipótesis mecánica, no demostrada:** bajo ráfaga de trades el writer procesa
más filas por lote y su competencia por el GIL con el loop de asyncio alarga la
cola. Encaja con que `receive_to_writer_start` sea la métrica más lenta del gate
(p50 163 ms, que es cola de escritura por diseño) y con que suba el `max` del
loop sin que suba el p50.

**Lo que NO demuestra:** correlación con volumen es compatible con una causa
externa común — más trades significa más actividad de mercado y más de todo.
Separarlo exige el banco offline con caudal de trades sintético y el writer
activado/desactivado. Es offline, no graba, y es el siguiente paso propuesto.

## Consecuencia para la prioridad

El siguiente trabajo **no es de sistema, es del colector**: el acoplamiento entre
el writer y el event loop bajo ráfaga de trades.

Eso rebaja la urgencia del gate de baseline de 4 h: serviría para atribuir el
pasado, no para arreglar lo que queda.

## Cuadro de latencias del gate, para situar

| qué mide | p50 típico | p95 típico | peor |
|---|---|---|---|
| `receive_to_writer_start` (cola de escritura, por diseño) | 163.07 | 292.44 | 3201.96 |
| `exchange_to_receive_depth` (red desde Binance) | 2.47 | 5.86 | 551.69 |
| `book_pipeline_total` (procesado propio) | **1.08** | 3.69 | 31.72 |
| `event_loop_lag` | **0.084** | 1.21 | 584.11 |

El objetivo de 5 ms se cumple en la ruta que importa: el procesado propio va a
1.08 ms típico y 3.69 ms en p95. Los 2.47 ms de red son distancia física a Tokio.
