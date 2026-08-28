# El atasco no está en ninguna etapa del trabajo: las colas están vacías

28/08/2026 · gate post-máscara · `herramientas/ablacion_produccion.py`, `herramientas/leer_excedencias.py`

## El hallazgo en una frase

En el instante del peor atasco —584 ms— **todas las colas del proceso estaban
vacías**, ninguna etapa medida subió, el host estaba al 97 % de reposo y el
hipervisor no robó nada. El proceso no tenía trabajo pendiente y aun así se paró
más de medio segundo.

## 1. La ablación no necesitaba un banco

Producción publica la latencia de **18 etapas** en cada ventana. La pregunta
—¿qué etapa se atasca con el loop?— se responde sobre datos que ya existen.

Método del flanco: cuando el `max` de `event_loop_lag` sube en ventana madura,
hubo una muestra nueva peor que todas las anteriores. Se mira qué otra etapa
subió en esa misma ventana. Los flancos deduplican el solapamiento del 97.5 %.

usdm_futures, 8 flancos por encima de 100 ms:

| etapa | sube con flanco | tasa base | exceso |
|---|---|---|---|
| `exchange_to_receive_trade` | 3/8 (38 %) | 4 % | **+2.7** |
| `exchange_to_receive_depth` | 1/8 | 1 % | +1.0 |
| `parse` | 1/8 | 5 % | +0.6 |
| `book_apply` | **0/8** | 0 % | −0.0 |
| `book_pipeline_total` | **0/8** | 0 % | −0.0 |
| `dashboard_project` | **0/8** | 0 % | −0.0 |
| `journal_build` / `journal_enqueue` | **0/8** | 0 % | −0.0 |
| `csv_write` | **0/8** | 4 % | −0.3 |
| `csv_flush` / `csv_fsync` | **0/8** | 0 % | −0.0 |
| `writer_cooperative_yield` | **0/8** | 3 % | −0.2 |
| `receive_to_writer_start` | **0/8** | 4 % | −0.3 |

**Ninguna etapa del trabajo propio sube.** El camino de escritura entero tiene
exceso negativo: sube menos de lo que subiría por azar.

`exchange_to_receive_trade` sí aparece, pero es **consecuencia, no causa**: mide
del sello del exchange hasta que recibimos, y recibir ocurre dentro del loop. Si
el loop está parado, el mensaje espera sin leerse y esa latencia se infla por
definición.

## 2. El host estaba ocioso

`sar -u` de `/var/log/sysstat/sa28`, ventana 15:50–17:00:

```
            %user  %nice  %system  %iowait  %steal   %idle
16:00:01     1.21   0.00     0.21     0.05    0.00   98.53
16:20:19     2.69   0.00     0.27     0.07    0.00   96.98
16:30:06     3.56   0.00     0.31     0.08    0.00   96.05
16:50:21     2.50   0.00     0.25     0.07    0.00   97.19
```

**`%steal = 0.00` en toda la ventana.** Límite: granularidad de 10 minutos, no
puede ver un suceso de 584 ms. Solo descarta contención **sostenida**.

## 3. La evidencia directa, del contexto de la excedencia

La instrumentación de excedencias captura el estado en el instante del suceso:

```
lag 584.107 ms   secuencia 799   context_sampled: True
  loop_clock_lag_ms: 583.999976       <- los dos relojes coinciden
  clock_delta_ms:    0.106527
  gc_count:      [59, 3, 0]           <- umbral [50000, 100, 100]
  writer_queued_rows: 0    writer_queue_size: 0
  raw_queue_size: 1        raw_bytes_inflight: 327
  trade_queue_size: 0      book_queue_size: 0    partial_queue_size: 0
  writer_fatal: False
```

Los dos relojes coinciden, así que no es artefacto de medición: es tiempo de
pared real.

Corrección de una cifra anterior: se dijo «6 excedencias». Son **800 únicas** en
spot sobre umbral de 20 ms. El 6 era el contador **por ventana**, no acumulado.

## 4. Qué cae y qué queda

**Cae, con evidencia de producción y no de banco:**

- el writer, el encolado y todo el camino de escritura
- el procesado del libro y la proyección al dashboard
- la contención sostenida del host y el robo de CPU del hipervisor
- la acumulación en colas como mecanismo

**Queda:** un atasco de tiempo de pared, con las colas vacías, sin que ninguna
etapa medida suba, en una máquina ociosa. Eso es tiempo que el proceso pasa
**fuera** del trabajo instrumentado. Cuatro candidatos, ninguno distinguible con
lo que hay hoy:

1. descheduling del hilo por el planificador del sistema
2. fallo de página mayor
3. pausa de GC que `gc_count` no captura, por ser contador y no duración
4. `epoll` que no retorna

## 5. Lo que hace falta para distinguirlos

Dos añadidos al evento de excedencia, ambos del lado del proceso y sin I/O en la
ruta caliente:

1. **Duración de la última pausa de GC**, no solo contadores. Con `gc.callbacks`
   se mide sin tocar la ruta caliente.
2. **`ru_majflt` y `ru_nivcsw` de `resource.getrusage`** en el instante del
   suceso. Dos enteros, coste despreciable, y separan «me desalojaron» de «me
   bloqueé».

Con esas dos, el siguiente gate distingue las cuatro hipótesis. Sin ellas, se
sigue infiriendo.

## 6. Por qué el banco sintético nunca lo reprodujo

El banco corre unos minutos, en un proceso limpio, sin una hora de estado
acumulado, sin dos mercados, sin dashboard ni REST, y sin la máquina haciendo
nada más. Si el mecanismo es descheduling o fallo de página, **el banco es
precisamente el entorno donde no ocurre**.

Peor lag del banco V2 tras 60 s × 3 × 4 condiciones, con cierre exacto y cero
rechazos: **5.064 ms**. Producción: 584 ms.
