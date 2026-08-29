# El defecto que invirtió el resultado: `to_thread` en serie no es la forma real

**Fecha:** 2026-08-29
**Origen:** turno 034 de ChatGPT en el canal IA-IA, corregido en el 035.

## Qué encontró ChatGPT

`banco_v23.py`, brazo `snapshot_en_thread_doble`, dentro de `publicar_una_vez()`:

```python
else:
    for m in metricas:
        doc = await asyncio.to_thread(m.snapshot)
        await asyncio.to_thread(_dumps, doc)
```

Ese bucle es **secuencial**. El brazo declaraba medir "la forma real, dos
mercados", pero nunca puso dos hilos a la vez. Su cero no podía responder la
pregunta bajo estudio, que es precisamente si dos hilos compitiendo por el GIL
alcanzan al event loop.

Defectos secundarios del mismo brazo, todos concedidos:

- el docstring anunciaba `QueueHandler/QueueListener`; el código no crea cola
- registraba umbrales de GC (`gc.get_threshold`), no **duración** de pausas
- no registraba CPU ni cambios de contexto
- los doce brazos compartían proceso, y con él el estado de GC y del heap
- solo persistía al terminar: una interrupción no dejaba ni resultado ni diagnóstico

## Por qué el artefacto de V2.3 no existía

Causa resuelta, no inferida: la corrida se lanzó **sin `nohup` y sin
redirección**. El proceso colgaba de la sesión remota y murió con ella, sin
dejar stdout ni stderr. Relanzado con `nohup … > log 2>&1 &`, sobrevive.

## Falsa alarma que casi publico

Buscando el intérprete no encontraba `uvloop` ni `orjson` y estuve a un paso de
anunciar que faltaban dependencias de producción. **Estaban.** Mis búsquedas
usaban `-maxdepth` demasiado corto. Viven en
`/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv`
(uvloop 0.22.1, orjson 3.11.9). El error de método es el recurrente: concluir
desde una búsqueda que no alcanzaba.

## V2.3.1 y el resultado que invierte el anterior

`banco_v231.py` corrige los seis puntos: subproceso limpio por brazo, brazo
`thread_doble_concurrente` con `asyncio.gather`, `gc.callbacks` con reloj
monotónico para duración real de pausas, `getrusage`, checkpoint JSONL con
`fsync` tras cada brazo y reanudación. Conserva `thread_doble_serie` como brazo
propio para que serie-contra-concurrente quede **medido**, no supuesto.

Tiempo bajo candado: **no se mide, y se declara** en el campo `no_medido`. La
API de `Metrics` no lo expone y envolverla alteraría la semántica bajo estudio.

Smoke test, `DURACION_S=8 REPS=1`, un publish por brazo:

```
  brazo                         >20ms/min   peor max  coste snap    gc max
  sin_snapshot                        0.0      1.500       0.00 ms    0.000
  snapshot_en_loop                    0.0     10.175      30.18 ms    0.000
  thread_uno                          0.0      6.726      29.27 ms    0.000
  thread_doble_serie                  0.0      7.133      62.19 ms    1.310
  thread_doble_concurrente            7.5     26.367      60.69 ms    1.370
```

El único brazo que excedió 20 ms fue el corregido. El serie —el de V2.3— dio
7.133 ms; el concurrente, con el mismo trabajo, 26.367 ms.

## Lo que este smoke NO demuestra

- **n = 1.** Un publish por brazo. Es un smoke test, no evidencia.
- **La regla de decisión propia invalida la corrida**: el control positivo se
  quedó en 10.175 ms, bajo el umbral. Por ese criterio ningún otro brazo cuenta,
  y el número que no cuenta es justamente el favorable.
- Las pausas de GC medidas son de 1.31 y 1.37 ms. No producen 26 ms. **GC no
  explica esto.**

## Lo que sí sostiene

`coste_snap` concurrente (60.69 ms) ≈ serie (62.19 ms). El `gather` **no**
repartió el trabajo en paralelo. Es lo esperable si dos hilos de Python puro se
disputan el GIL: no se solapan, se intercalan. Y ese intercalado es lo que puede
alcanzar al loop.

Si se confirma en la corrida larga, el mecanismo dado por muerto en el turno
033 —"`to_thread` no bloquea el loop"— era falso por una razón distinta de la
argumentada entonces: `to_thread` no bloquea con **un** hilo; con **dos**
compitiendo, sí puede.

## Estado

Corrida larga en marcha: `DURACION_S=120 REPS=3` × 5 brazos, con `nohup`, log en
`banco_v231.log` y checkpoint incremental en `banco_v231_checkpoint.jsonl`.
Resultado se publica salga como salga.

Sin cambios en producción, servicios, IAM, datos, commits ni worktree.

---

## CIERRE — las tres repeticiones

```
  brazo                         >20ms/min   peor max  coste snap    gc max
  sin_snapshot                        0.0      1.759       0.00 ms    0.000
  snapshot_en_loop                   11.0     28.793      26.24 ms    0.000
  thread_uno                          0.0      7.866      26.56 ms    0.000
  thread_doble_serie                  0.0      8.618      52.17 ms    1.396
  thread_doble_concurrente            3.0     41.254      54.74 ms    1.366

  Control positivo 22. Doble CONCURRENTE 6 (serie 0).
```

Medianas de tres repeticiones con orden alternado, cada brazo en subproceso
limpio. El resultado de rep0 aguanta las tres.

## POSDATA — un defecto de mi propio banco, encontrado al verificar

Al ir a buscar los números de producción en vez de citarlos de memoria:

| parámetro | producción | banco V2.3.1 |
|---|---|---|
| `thread_switch_s` (conmutación del GIL) | **0.001** | **0.005** |
| `gc_thresholds` | **(50000, 100, 100)** | **(700, 10, 10)** |

Producción: línea `low_latency_runtime` del gate
`20260828T155419Z_tokyo_postmask_gate_30m`. Banco: campo `switch_interval_s`
de la identidad que el script registra.

**Esto va en contra del resultado.** El intervalo de conmutación del GIL es
justo el parámetro que gobierna el mecanismo bajo estudio. Producción lo baja
a 1 ms; el banco corrió con el defecto de 5 ms. Un hilo que retiene el GIL
cinco veces más tiempo produce retrasos más largos por construcción.

**Sobrevive:** el contraste entre brazos dentro del banco — serie 0 contra
concurrente 6, mismo intérprete, misma semilla, mismo coste de snapshot.
Comparación interna, sigue en pie.

**No sobrevive:** los 41.254 ms como magnitud transferible a producción. El
banco exagera la contención y además recolecta basura mucho más a menudo.

Corresponde repetir con `sys.setswitchinterval(0.001)` y
`gc.set_threshold(50000, 100, 100)`, verificados contra `low_latency_runtime`.

## Los dos relojes que no hay que confundir

El objetivo de 5 ms es sobre **el dato**, no sobre el event loop. Gate
post-máscara, última publicación:

| serie | p50 | p95 | p99 | max |
|---|---|---|---|---|
| `book_pipeline_total` | **0.900** | **3.156** | 5.657 | 23.218 |
| `event_loop_lag` | 0.103 | 1.333 | 4.843 | 584.113 |

El objetivo se cumple en el caso normal. Los picos del event loop son otra
magnitud: 871 de 1 384 intervalos de 5 s (62.9 %) contienen al menos un pico
por encima de 20 ms. Cuando el loop tropieza, el dato que llegaba espera con
él — de ahí el max de 23.218 ms en una serie cuyo p95 es 3.156 ms.
