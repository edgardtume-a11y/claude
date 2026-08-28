# Latencia: conclusión tras una noche de medir

**Fecha:** 28/08/2026, 02:35 UTC (27/08, 21:35 Perú)
**Trabajo:** cinco hipótesis, cinco mediciones.
**Resultado:** una mejora real aplicada. Todo lo demás, descartado con números.

---

## 1. El recuento

| | Hipótesis | Resultado |
|---|---|---|
| M1 | Domar el recolector de basura | **Ya estaba hecho** — y mejor de lo propuesto |
| M2 | Trocear la escritura + ceder el turno | **Ya estaba, y la otra mitad es inaplicable** (el escritor es un hilo, no una tarea) |
| M3 | uvloop | **APLICADA. La única real.** |
| H1 | `writerows()` retiene el GIL y bloquea el bucle | **REFUTADA**: los 4 escenarios dan p99 = 1.000 ms |
| H5 | El bucle va saturado | **REFUTADA**: correlación r = 0.15-0.22, 0 % de ventanas cerca del límite |
| H4 | La validación del libro genera basura | **DESPRECIABLE**: 2.63 s de CPU **al día** |
| — | El panel publica de más | **DESPRECIABLE**: 28-73 s de CPU **al día** |

Y sobre todas ellas, el hallazgo que las invalidaba a medias: **el problema de los
19 ms no existía**. Era el arranque, que el propio auditor ya excluía
(`planes/EL_PROBLEMA_DE_19MS_NO_EXISTIA.md`).

---

## 2. Los números del último banco

### La validación del libro

Comparando la implementación actual (`set()` + `sorted()`) contra una en una
sola pasada sin crear objetos:

| | Valor |
|---|---|
| Diferencia por evento (100 niveles) | **1.522 µs** |
| Diferencia de CPU al día (20 ev/s) | **2.63 segundos** |
| Frente a un retraso de 19 ms | **0.0314 %** |
| Objetos evitados al día | 6 912 000 |
| Memoria efímera evitada al día | **16.76 GB** |

**Y aquí me corrige un dato que yo daba por hecho:** `sorted()` y `set()` están
escritos en C, y resultan **más rápidos** que un bucle `for` en Python, aunque
creen objetos. Mi propuesta de "una sola pasada sin asignar nada" habría sido
**más lenta en tiempo**, aunque más limpia en memoria.

Yo asumí que evitar asignaciones era evitar trabajo. En CPython, salir al
intérprete para recorrer una lista cuesta más que dejar que C la ordene entera.

Los 16.76 GB/día de memoria efímera evitada son reales, pero **no se traducen en
latencia**: los umbrales del recolector ya están domados y `gc.freeze()` ya saca
del barrido lo que no es basura.

### El panel

| | Valor |
|---|---|
| Serializar un libro (100 niveles/lado) | 5.777 µs |
| Serializar un marco completo | 15.014 µs |
| CPU al día a 56 publicaciones/s | **28 a 73 segundos** |
| Frente a un retraso de 19 ms | **0.079 %** |

Además el panel **delega en hilos secundarios**, así que ni siquiera esos 15 µs
caen enteros en el bucle. Mi sospecha de "281 publicaciones por segundo para
nadie" era cierta como observación e **irrelevante como problema**.

---

## 3. Lo que sí funcionó

**uvloop + `gc.freeze()`.** Es la única de las cinco que dio algo, y dio mucho:

| Métrica | Antes | Después | Mejora |
|---|---|---|---|
| `event_loop_lag` p99, a igual carga | 4.7-5.2 ms | 2.1-2.4 ms | **52-56 %** |
| Peor p99 tras el arranque | 10.89 ms | 3.0 ms | **72.5 %** |
| `usdm.book_apply` peor p99 | 3.185 ms | 2.347 ms | 26 % |
| `usdm.book_pipeline_total` | 3.602 ms | 2.770 ms | 23 % |
| Auditorías que certifican | 3 de 4 | **4 de 4** | — |

---

## 4. La conclusión, sin adornos

> **En el camino caliente del colector no queda latencia que ganar.**
>
> Todo lo que se ha medido esta noche, salvo uvloop, resultó ya hecho,
> inaplicable, o despreciable por dos o tres órdenes de magnitud.

Esto no es rendirse: es un resultado. Saber que no hay nada que optimizar
**evita gastar semanas optimizando**. Y viene respaldado por bancos de pruebas
que quedan escritos y se pueden repetir.

### La única idea que queda sin medir

**Afinidad de CPU** (`sched_setaffinity`) y ajuste del buffer del socket
(`SO_RCVBUF`). Ninguna aparece en el código.

Pero con lo aprendido esta noche, mi expectativa honesta es **baja**: la máquina
es una n2 dedicada de 8 núcleos con una carga en reposo de 0.05-0.18. Con siete
núcleos libres, el planificador de Linux casi no tiene motivo para mover los
hilos. Fijar la afinidad ayuda cuando hay competencia por los núcleos, y aquí no
la hay.

Merece una medición porque es barata, no porque prometa mucho.

---

## 5. Dónde sí queda trabajo, y no es latencia

El cuello de botella real del proyecto **ya no está en el motor**:

1. **Disco** — resuelto esta noche (32 GB → 638 MB) y con el rotador listo para
   que ocurra solo durante la captura.
2. **Escala a muchos símbolos** — cuando pases de 1 moneda a 20, un solo bucle
   de eventos sí será el límite. Ahí el camino es **un proceso por símbolo o por
   mercado**, y eso no es optimizar: es repartir.
3. **Las horas de captura** — el gate de 6 h, luego 24 h, luego 7 días. Eso es
   tiempo de reloj, y ningún truco lo acorta.

---

## 6. Lo que me llevo del método

Cinco hipótesis, cinco mediciones, **una acierta**. Y las cuatro que fallaron
costaron minutos de máquina cada una.

La alternativa —"arreglar" el escritor, reescribir la validación, apagar el
panel— habría costado días de trabajo, habría metido código nuevo en el camino
de los datos, y habría dejado el sistema **peor**: más complejo, con el mismo
rendimiento.

> **Medir antes de arreglar no es prudencia. Es lo que separa el trabajo del
> movimiento.**

Y la lección concreta que más me sorprendió: **no supongas que evitar
asignaciones es evitar trabajo.** En CPython, una función en C que crea objetos
puede batir a un bucle en Python que no crea ninguno.
