# El problema de los 19 ms no existía

**Fecha:** 28/08/2026, 00:35 UTC (27/08, 19:35 Perú)
**Qué falla:** mi medición. No el sistema.
**Consecuencia:** las dos hipótesis que construí encima eran respuestas a una
pregunta mal hecha.

---

## 1. Lo que dije

Que `event_loop_lag` tenía un peor p99 de **19.0 ms** contra un límite de 20, que
pasaba "con un 5 % de margen", y que era **la próxima grieta** del sistema — lo
primero que rompería en un gate de 24 h.

Sobre esa premisa levanté dos hipótesis:
- **H1:** el escritor bloqueaba el bucle. **Refutada** por medición.
- **H5:** el bucle iba saturado. **Refutada** por medición.

Dos hipótesis, dos refutaciones. Y resulta que el error estaba un paso más
atrás: **en el número de partida**.

---

## 2. Lo que dicen los datos

El análisis sobre las dos capturas completas encuentra:

### El 19 ms es el arranque, no el régimen

Ocurre **exclusivamente en el primer instante de la captura** — los primeros
segundos, mientras se abren los websockets y se procesan los primeros snapshots
REST, que son masivos. Pasado ese primer tick, el retraso cae de inmediato.

### La distribución real, después del arranque

| | Gate 3 (sin uvloop) | Gate 4 (con uvloop) |
|---|---|---|
| Ventanas con p99 de 4-5 ms | **81.6 %** | — |
| Ventanas con p99 ≤ 3 ms | — | **100 %** |
| Peor p99 tras el arranque | **10.89 ms** | **3.0 ms** |
| **Ventanas en el rango 19-20 ms** | **0 %** | **0 %** |

**Cero por ciento.** No hay ninguna ventana en régimen normal cerca de los 19 ms.
El sistema nunca estuvo raspando el límite: estuvo a la mitad, y con uvloop a
la sexta parte.

### Y la correlación con la carga es débil

Pearson r = 0.15 a 0.22 entre ritmo de mensajes y retraso. Si fuera saturación,
esa relación sería fuerte. No lo es. Los ticks perdidos son menos del **0.04 %**
de las muestras, y se asocian a micro-ráfagas de red, no a un retraso
estructural.

---

## 3. De dónde salió mi error

Yo mismo escribí el guion que calculaba "el peor p99 por ventana de 30 minutos"
y tomé el máximo de todas las ventanas. **Ese máximo era el arranque.**

Lo peor es que la respuesta estaba delante de mí. Horas antes leí, en
`audit.py`, este comentario del autor:

> `# [2.3.9] Exclusión de CALENTAMIENTO explícita del gate de p99. […] el`
> `# arranque del proceso (import, sincronización inicial, primer snapshot REST…`

El autor **ya había identificado esto** y había excluido el calentamiento del
criterio de certificación. Por eso las métricas del libro se evalúan con
`"basis": "worst_p99_post_warmup"` — lo vi escrito en el propio `metrics.json`.

Y por eso la auditoría de métricas **nunca reprobó** por `event_loop_lag`: en el
gate 3 sólo fallaron `book_apply_p99` y `book_pipeline_p99`. `event_loop_lag`
pasaba sin problemas.

**El 19 ms nunca fue un veredicto del sistema. Fue un número que calculé yo,
sin excluir el arranque, y que luego traté como si fuera un diagnóstico.**

---

## 4. La buena noticia: uvloop es mucho mejor de lo que reporté

Dije que uvloop había mejorado `event_loop_lag` un **4 %** frente al 23-29 % de
las demás métricas, y que eso me chirriaba. Chirriaba porque era falso.

Comparando **a igualdad de carga de mensajes** (15-50 msg/s), que es como se
debe comparar:

| Métrica | Gate 3 | Gate 4 | Mejora |
|---|---|---|---|
| `event_loop_lag` p99, misma carga | 4.7 - 5.2 ms | 2.1 - 2.4 ms | **52 - 56 %** |
| Peor p99 tras el arranque | 10.89 ms | 3.0 ms | **72.5 %** |

El 4 % era un artefacto de comparar dos valores que estaban ambos dominados por
el arranque (19.77 contra 19.0). Comparaba dos veces el mismo ruido.

### Y esto responde, en parte, a la pregunta que dije que no podía responderse

Ayer escribí que el A/B no podía demostrar causalidad porque el mercado estaba
más flojo en el gate 4. Este análisis **compara a igualdad de carga** —los mismos
15-50 mensajes por segundo en ambas capturas— y ahí uvloop sigue ganando un
52-56 %.

Eso **controla el confusor por construcción**, que es exactamente lo que
reclamaba la prueba de 48 h en paralelo. No la sustituye del todo —sigue siendo
un análisis retrospectivo, no un experimento controlado— pero es mucho más de lo
que yo daba por posible.

---

## 5. Qué se corrige, en concreto

| Lo que dije | Lo correcto |
|---|---|
| "`event_loop_lag` pasa con un 5 % de margen" | Pasa con más del **80 %** de margen en régimen normal |
| "Es la próxima grieta del gate de 24 h" | **No lo es.** Cero ventanas cerca del límite |
| "uvloop sólo mejoró un 4 % aquí" | Mejoró **52-56 %** a igualdad de carga |
| "El A/B no puede demostrar causalidad" | A igualdad de carga, sí muestra el efecto |

**Los pendientes 12 y 5 de `PENDIENTES_HANDOFF.md` quedan cerrados sin trabajo
pendiente.** No hay que arreglar nada.

---

## 6. Lo que aprendo

Las dos refutaciones costaron unos minutos de máquina cada una y valieron la
pena. Pero ninguna era necesaria: **si hubiera excluido el arranque al calcular
el número —como ya hacía el propio auditor del sistema— no habría habido
hipótesis que refutar.**

La regla que sale, y que es distinta de las de esta noche:

> Antes de investigar por qué un número es malo, **comprobar que el número está
> bien calculado.** Y antes de calcularlo a mano, mirar si el sistema ya lo
> calcula — y cómo.

El auditor de JEAN FLOW ya excluía el calentamiento. Yo escribí mi propio
cálculo y me salté esa exclusión. Tres veces en el mismo día he reescrito algo
que el sistema ya tenía resuelto: las mejoras M1 y M2, el conversor a Parquet, y
ahora el criterio de exclusión del arranque.

**El patrón ya no admite duda: este motor está más terminado de lo que parece, y
mi primer instinto debería ser buscar antes que construir.**
