# Qué queda por hacer para bajar la latencia

**Fecha:** 27/08/2026, ~21:40 UTC (16:40 Perú)
**Método:** leer el código real del colector antes de proponer nada. La
auditoría cruzada de esta mañana falló justo por no hacerlo: dos de sus tres
recomendaciones ya estaban implementadas.

---

## 1. Lo que YA está optimizado (no tocar)

Antes de proponer, hay que saber qué existe. Esto es lo que el colector **ya
hace**, verificado leyendo el código:

| Optimización | Dónde | Estado |
|---|---|---|
| `orjson` en el camino caliente | `collector.py`, `protocol.py`, `rest.py`, `dashboard.py` | **Ya está.** `json.loads` aparece **0 veces** en `collector.py` |
| Compresión del websocket desactivada | `collector.py:400` `compression=None` | **Ya está.** Comprimir añade latencia; está bien apagado |
| Umbrales del recolector de basura | `latency.py` `(50000, 100, 100)` | **Ya está**, y configurable por entorno |
| Intervalo de cambio de hilo | `latency.py` `sys.setswitchinterval(0.001)` | **Ya está** |
| Escritura por lotes | `writer.py` `write_chunk_rows=64` + `writerows()` | **Ya está** |
| `fsync` espaciado, no por fila | `writer.py` `fsync_interval_s=5.0` | **Ya está** |
| Sonda de retraso independiente | `collector.py:1412` — no mezcla el tick con serialización ni registro | **Ya está**, y bien diseñada |
| `uvloop` como bucle de eventos | `dual_main.py` | **Aplicado hoy** (gate 4) |
| `gc.freeze()` antes de arrancar | `dual_main.py` | **Aplicado hoy** — 41 652 objetos congelados |

**Conclusión incómoda pero útil: las optimizaciones obvias ya están hechas.**
Lo que queda es más difícil y más específico.

---

## 2. El objetivo: los 19 ms de `event_loop_lag`

Es la única métrica que sigue pegada a su límite.

| | Gate 3 (sin uvloop) | Gate 4 (con uvloop) | Límite |
|---|---|---|---|
| spot | 19.8 ms | 19.0 ms | 20 ms |
| usdm | 19.8 ms | 19.0 ms | 20 ms |

Todas las demás métricas mejoraron un 23-29 %. Esta, un 4 %.

### Por qué el límite de 20 ms es el correcto aquí

El código documenta una revisión explícita del criterio, subiéndolo de 20 a 40 ms
(`audit.py`, constante `EVENT_LOOP_P99_LIMIT_MS = 40.0`). Pero el razonamiento
del autor dice literalmente:

> *"El límite de 20 ms era un criterio de grado servidor (Linux con timer de
> alta resolución). En Windows de escritorio el cuanto del temporizador es
> 15.625 ms (64 Hz) […] la cola de la distribución vive en {15.6, 31.25} ms
> por construcción del sistema operativo, no por atasco del colector."*

La relajación a 40 ms era **exclusivamente para Windows**, la laptop del
operador. Ahora corremos en **Linux**, donde el temporizador es de alta
resolución y no existe ese cuanto de 15.6 ms.

**Por tanto: en Linux, 19 ms de retraso NO es el reloj. Es un atasco real.** Y
por eso nuestro script de auditoría pasa `--event-loop-p99-ms 20`, que es el
criterio que el propio autor llamó "de grado servidor".

### Qué mide exactamente la sonda

```python
deadline = loop.time() + interval
while not stop.is_set():
    await asyncio.sleep(max(0.0, deadline - loop.time()))
    lag_s = max(0.0, loop.time() - deadline)
    self.metrics.observe("event_loop_lag", lag_s * 1_000)
```

Duerme hasta un instante fijado de antemano y mide **cuánto se pasó**. Si el
bucle estuviera libre, despertaría casi puntual. 19 ms de retraso significa que
**algo tuvo el bucle ocupado 19 ms sin cederlo**.

En un bucle asyncio solo hay una cosa que puede hacer eso: **trabajo síncrono
que no suelta el control**.

---

## 3. Las cuatro hipótesis, en orden de probabilidad

### H1 — El GIL retenido por `csv.writerows()` ⭐ la más prometedora

`writerows()` es una función en **C** del módulo `csv`. Las funciones en C **no
sueltan el GIL** salvo que lo pidan explícitamente, y `csv` no lo pide.

Mientras el hilo escritor ejecuta `writerows(chunk)`, el bucle de eventos —que
vive en otro hilo— **no puede ejecutar nada**. Ni siquiera despertar a la sonda.

Y `sys.setswitchinterval(0.001)` **no ayuda aquí**: ese ajuste hace que el
intérprete considere ceder el GIL cada milisegundo, pero solo **entre
instrucciones de bytecode**. `writerows` es *una sola* instrucción desde la
óptica del intérprete. Una vez dentro, no hay punto de cesión hasta que termina.

**Evidencia a favor:**
- Futuros escribe **112 816 filas/min**, spot **52 656**. Más del doble. Y
  futuros es donde fallaban las métricas del libro.
- uvloop apenas movió esta métrica (−4 %) mientras movía las otras un 23-29 %.
  Coherente: **uvloop acelera el bucle, pero no puede correr si no tiene el GIL.**
- El propio código tiene un contador llamado `writer_gil_yields` — el autor ya
  sospechaba de esto.

**Qué habría que medir:** el tiempo de pared de cada llamada a `writerows`, y
correlacionarlo con los picos de `event_loop_lag` en la misma ventana temporal.

### H2 — La rotación de fichero

Cada CSV se cierra al llegar a ~512 MB y se abre otro. El gate 3 rotó **37
veces**. Cerrar implica vaciar los buffers y posiblemente un `fsync` de un
fichero de medio giga.

**En contra:** 37 eventos en 4h45 son demasiado pocos para mover un p99 sobre
ventanas de 10 000 muestras. Explicaría un `max` alto, no un p99.

### H3 — El snapshot REST del libro

Futuros tomó **42 snapshots** (spot, 1). Cada uno trae 100 niveles que hay que
parsear y aplicar de golpe.

**A favor:** explica por qué futuros sufre más. **En contra:** 42 eventos,
mismo problema estadístico que H2.

### H4 — La validación con `sorted()` en el libro

`order_book.py:386-388`:

```python
if bids != sorted(bids, reverse=True):
if asks != sorted(asks):
```

Construye una lista ordenada **nueva** y la compara entera, cada vez. Con 100
niveles no son 19 ms, pero es trabajo evitable: comprobar que una lista está
ordenada se hace en una pasada, sin construir nada. Si se ejecuta por cada
mensaje de profundidad (~600/min por mercado), es basura generada
constantemente — precisamente lo que hace trabajar al recolector.

---

## 4. Lo que falta, más allá del atasco

Verificado por lectura del código: **no aparece en ninguna parte**.

### F1 — Afinidad de CPU

`sched_setaffinity` no se usa. En una **n2-standard-8 dedicada** eso deja al
planificador de Linux mover los hilos entre los 8 núcleos libremente. Cada
migración cuesta caché fría.

Lo correcto sería: bucle de eventos clavado a un núcleo, hilo escritor a otro,
y ninguno de los dos en el núcleo 0 (que atiende interrupciones).

**Era la segunda mitad de M3 y se quedó fuera.** Es la mejora pendiente más
concreta.

### F2 — Ajuste del socket de recepción

No hay ni un `setsockopt` en el código. `TCP_NODELAY` lo pone asyncio por su
cuenta, así que eso está cubierto. Pero **`SO_RCVBUF` se queda en el valor por
defecto del sistema**. Con ráfagas de mercado, un buffer de recepción pequeño
obliga al kernel a descartar o frenar.

### F3 — Auditorías en paralelo

No es latencia de captura, es tiempo de tu jornada. Hoy: spot 6 min → usdm
11 min → identity → metrics, **en fila**. Spot y usdm son independientes.

En paralelo, 17 min pasan a ~11. En el gate de 24 h, con 90 GB, la diferencia
serán horas.

### F4 — `msgspec` (evaluar, no aplicar)

No está instalado. Para decodificar mensajes con estructura conocida puede batir
a `orjson`. Pero `orjson` ya está y es muy rápido: **la ganancia sería marginal
y el riesgo alto** (reescribir el parseo del camino caliente). No lo recomiendo
todavía.

---

## 5. Tareas para Gemini, en orden

Todas siguen el flujo de `operaciones/PROTOCOLO_ROLES_AUTOR_REVISOR.md`.

**Lección de hoy aplicada:** el primer encargo de la mañana pedía 3 mejoras en
2 archivos y **falló por agotar el tiempo a los 19 minutos**. Partido en uno,
salió en 3.5. Así que aquí "ultra compleja" significa **profunda**, no ancha:
cada tarea es un objetivo y un archivo.

| | Tarea | Tipo | Por qué es difícil |
|---|---|---|---|
| **T1** | Conversor Parquet con borrado verificado | código | Borra datos. Ya entregado, revisado y en ejecución |
| **T2** | Diagnosticar los 19 ms: instrumentar `writerows` y correlacionar con los picos de la sonda | **análisis** | Hay que medir el GIL sin alterar lo que se mide |
| **T3** | Afinidad de CPU + `SO_RCVBUF` | código | Tocar el planificador puede empeorar; exige A/B |
| **T4** | Auditorías spot y usdm en paralelo | código | Sencilla, alto valor en gates largos |

**T2 primero.** No tiene sentido escribir la solución antes de saber cuál es el
problema — es exactamente el error que cometimos esta mañana.
