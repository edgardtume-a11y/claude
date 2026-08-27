# H1 refutada: el escritor no es el culpable de los 19 ms

**Fecha:** 27/08/2026, 22:37 UTC (17:37 Perú)
**Hipótesis del revisor:** equivocada.
**Banco:** `/home/trading/jean-flow-exec/herramientas/banco_gil.py` (autor: Gemini;
ejecutado por el revisor tras quedarse colgado el encargo).

---

## 1. Lo que se sospechaba

Que `csv.writer.writerows()`, al ser una función en C que no libera el GIL,
mantenía bloqueado el bucle de eventos durante la escritura del lote, y que por
eso `event_loop_lag` se quedaba clavado en 19 ms mientras el resto de métricas
mejoraban un 23-29 % con uvloop.

Los indicios parecían buenos: futuros escribe el doble de filas que spot y es
donde más se sufría; uvloop apenas movió esta métrica; y el propio código lleva
un contador llamado `writer_gil_yields`.

## 2. Lo que dice la medida

Cuatro escenarios, dos repeticiones cada uno, 60 s por corrida, al ritmo real de
**112 800 filas/minuto** (1880 filas/s, 32 MB por corrida), con uvloop y
CPython 3.12.3 — el mismo intérprete del colector.

| Escenario | p50 | p90 | **p99** | máx | Filas |
|---|---|---|---|---|---|
| **E0** sonda sola (suelo de ruido) | 0.000 | 1.000 | **1.000** | 2.000 | 0 |
| **E1** `writerows(lote 64)` | 0.000 | 1.000 | **1.000** | 2.000 | 112 832 |
| **E2** `writerows(lote 8)` | 0.000 | 1.000 | **1.000** | 1-2 | 112 808 |
| **E3** texto en Python + `f.write()` | 0.000 | 1.000 | **1.000** | 2.000 | 112 832 |

**Los cuatro dan exactamente lo mismo.** Escribir 32 MB por minuto con la
función en C sospechosa no degradó el bucle **ni un milisegundo** respecto a no
escribir nada.

### Veredicto

> **H1 REFUTADA.** El escritor no es la causa. Ni la llamada en C, ni el tamaño
> del lote, ni el GIL. La contención que yo suponía **no existe**.

---

## 3. Por qué el razonamiento era plausible y aun así falso

El error no estuvo en los hechos —`writerows` es en C y el GIL es real— sino en
suponer que un mecanismo posible es el mecanismo actuante. Lo que faltaba
comprobar es cuánto tiempo dura realmente esa retención: si `writerows(64)`
tarda microsegundos, el GIL se suelta antes de que nadie lo note.

Es el mismo error de la mañana con M1 y M2, en otra forma: **razonar sobre cómo
debería comportarse un sistema en vez de medirlo.** La diferencia es que esta
vez la medida llegó antes que el arreglo, que era justamente el objetivo de
encargar un diagnóstico y no una solución.

**Refutar costó ocho minutos de máquina. Haber "arreglado" el escritor sin medir
habría costado un gate entero, y no habría servido de nada.**

---

## 4. La siguiente hipótesis: H5 — el bucle no está bloqueado, está atascado

Si nada bloquea el bucle, hay que explicar los 19 ms de otra manera. Y hay una
pista fuerte en los propios datos.

### La pista

La sonda usa un intervalo de **20 ms** (`event_loop_probe_interval_s`). Y el
peor p99 medido en producción es **19.0 ms**: justo por debajo de un intervalo
completo. Además `event_loop_probe_missed_ticks` aparece con valor 2 en los
contadores reales.

Un p99 de 19 ms sobre ventanas de 10 000 muestras significa que **100 sondas de
cada 10 000 llegaron ~19 ms tarde** — es decir, unas 100 veces cada 200 segundos.
Eso no son picos raros: es algo constante.

### Qué explicaría ese patrón

Un bucle **bloqueado** por una llamada larga daría picos grandes y dispersos:
un máximo alto y un p99 bajo. Un bucle **saturado** —con más tareas listas de
las que puede despachar— da exactamente lo que vemos: un retraso que se pega
justo por debajo de un intervalo, porque la sonda siempre encuentra por delante
una cola de trabajo de unos 19 ms.

No es que algo pare el bucle. Es que el bucle **va con retraso permanente**.

### Por qué encaja con todo lo demás

- **Explica que uvloop apenas ayudara aquí (−4 %) y mucho en el resto (−23/−29 %).**
  uvloop hace cada operación más rápida, pero **no reduce cuántas operaciones
  hay**. Si el problema es la cantidad, acelerar cada una apenas mueve la cola.
- **Explica que futuros sufra más que spot**: 2550 mensajes de websocket por
  minuto frente a 2291, y sobre todo el trabajo por mensaje del libro.
- **Explica que el banco no lo reprodujera**: el banco tenía una sonda y un
  escritor. El colector real tiene además recepción de websocket, decodificación,
  aplicación de deltas al libro, cuatro colas, publicación al panel y sondeo REST
  — todo en el mismo bucle.

### Cómo comprobarla (T2-bis)

No hace falta tocar el motor. Con los datos que ya hay:

1. Correlacionar, ventana a ventana, `event_loop_lag` p99 contra
   `websocket_messages` y `depth_diff_messages` **de la misma ventana**. Si es
   saturación, la relación debe ser clara y creciente.
2. Comparar `event_loop_lag` entre spot y usdm en la misma ventana temporal:
   el que más mensajes procesa debe tener más retraso.
3. Medir cuánto tarda el bucle en despachar una tanda de tareas listas, con un
   banco que reproduzca **el número de tareas**, no el volumen de escritura.

**Si H5 se confirma, el arreglo NO es optimizar una función.** Es repartir el
trabajo: un proceso por mercado, que es exactamente el camino ya identificado
para las memecoins. Ahí el multiproceso deja de ser una idea de futuro y pasa a
ser la solución del problema presente.

---

## 5. Lo que no cambia

`event_loop_lag` sigue pasando (19.0 contra un límite de 20) con un margen del
5 %. Sigue siendo la próxima grieta en un gate de 24 h. Lo que cambia es que
ahora sabemos **dónde no está** el problema, y eso vale tanto como saber dónde
está: descarta el escritor, descarta el tamaño del lote, descarta el GIL.
