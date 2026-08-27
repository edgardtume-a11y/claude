# Veredicto del A/B: uvloop + `gc.freeze` en JEAN FLOW

**Fecha:** 27/08/2026, 21:15 UTC (16:15 Perú)
**Gate 3 (antes):** n2-standard-8 Tokio, 4 h 45, asyncio estándar — 14:56–19:41 UTC
**Gate 4 (después):** misma máquina, 30 min, uvloop 0.22.1 + `gc.freeze()` — 20:30–21:00 UTC
**Cierre del gate 4:** `LIVE_FINISHED engine_rc=0`, **0 ficheros parciales**, 1.1 GB

---

## 1. Veredicto en una línea

> **Se queda.** No rompe nada y las cuatro auditorías certifican por primera vez.
> Pero **no está demostrado que la mejora la cause uvloop**, y hay que decirlo.

---

## 2. Lo que quedó demostrado

### Las auditorías, por primera vez completas

| Auditoría | Gate 3 (antes) | Gate 4 (después) |
|---|---|---|
| `journal_spot` | 0 PASS | 0 PASS |
| `journal_usdm` | 0 PASS | 0 PASS |
| `identity` | 0 PASS | 0 PASS |
| `metrics` | **2 FALLA** | **0 PASS** |

Identidad del gate 4: **89 767 / 89 767** secuencias únicas, ratio **1.0**,
**0 conflictos, 0 errores**. Los deltas de futuros se aplicaron **todos**:
17 649 aplicados, **0 obsoletos** (el gate 3 tuvo 170 obsoletos y 9 inválidos).

### Los números internos, medidos con el mismo método

Peor p99 por ventana de 30 min. La base son diez ventanas del gate 3; el gate 4
es una sola ventana equivalente. Límite de certificación: 5.0 ms.

| Métrica | Base: mejor / mediana / peor | Gate 4 | vs el **mejor** tramo base |
|---|---|---|---|
| spot · `book_apply` | 1.400 / 2.768 / 3.561 | **0.996** | **−29 %** |
| spot · `book_pipeline_total` | 1.804 / 3.200 / 4.226 | **1.310** | **−27 %** |
| usdm · `book_apply` | 3.185 / 4.642 / 6.282 | **2.347** | **−26 %** |
| usdm · `book_pipeline_total` | 3.602 / 5.192 / 7.399 | **2.770** | **−23 %** |

Las dos que **hacían fallar el gate 3** —`usdm.book_apply` 6.282 y
`usdm.book_pipeline_total` 7.399— quedan en **2.347** y **2.770**. Holgura
frente al límite: de estar 48 % por encima a estar 45 % por debajo.

El gate 4 no solo bate la mediana: **bate el mejor de los diez tramos base**, en
las cuatro métricas y en los dos mercados.

### Que las mejoras se activaron de verdad

```
event_loop=uvloop version=0.22.1
gc_frozen=41652
low_latency_runtime thread_switch_s=0.001 gc_thresholds=(50000, 100, 100)
```

Y antes de lanzar, en prueba de humo: `uvloop.Loop` como bucle real, camino de
respaldo intacto si uvloop faltase, y `gc.freeze()` pasando de 375 a 16 265
objetos congelados (41 652 con el motor completo cargado).

---

## 3. Lo que NO quedó demostrado, y por qué

El mercado no estaba igual. Comparando la carga real por minuto:

| Contador | Gate 3 | Gate 4 | Cambio |
|---|---|---|---|
| `agg_trade_messages` (spot) | 1 091.4/min | 310.6/min | **−71.5 %** |
| `agg_trade_messages` (usdm) | 1 381.7/min | 351.6/min | **−74.6 %** |
| `websocket_messages` (usdm) | 2 550.7/min | 1 481.5/min | −41.9 % |
| `csv_rows_written` (usdm) | 112 816.8/min | 63 338.4/min | −43.9 % |
| **`depth_diff_messages` (spot)** | **599.9/min** | **599.2/min** | **−0.1 %** |
| **`depth_diff_messages` (usdm)** | **588.2/min** | **587.9/min** | **−0.0 %** |

Hay que leer esa tabla con cuidado, porque dice dos cosas opuestas:

**A favor de uvloop.** Las métricas que mejoraron —`book_apply` y
`book_pipeline_total`— miden **aplicar actualizaciones de profundidad al libro**.
Su motor directo es `depth_diff_messages`, que en Binance llega a cadencia fija
cada 100 ms. Y ese caudal fue **idéntico**: 599.9 → 599.2 y 588.2 → 587.9. El
libro procesó exactamente el mismo trabajo por minuto en ambos gates. *Menos
actualizaciones de libro* no puede explicar la mejora, porque no hubo menos.

**En contra.** La carga **total** del proceso sí bajó entre un 32 % y un 44 %:
un cuarto de los trades, la mitad de filas escritas. Y un p99 de cola es
precisamente lo que más sufre cuando el proceso va apretado. Con el escritor
menos presionado, hay menos disputa por el GIL, y el libro respira mejor
**aunque uvloop no existiera**.

### Conclusión honesta

**Indicio fuerte, no prueba.** A favor: la mejora es del 23–29 %, consistente en
cuatro métricas independientes y dos mercados, con el caudal que las gobierna
mantenido constante al 0.1 %. Una casualidad de mercado sería más errática. En
contra: no se puede separar cuánto puso uvloop y cuánto puso un proceso más
descargado.

Esto es exactamente lo que se anticipó **antes** de correr el gate, en
`operaciones/LINEA_BASE_AB_GATE4.md`. La predicción se cumplió; el método no
falló, es que un A/B secuencial no puede más que esto.

---

## 4. Lo que uvloop NO arregló

`event_loop_lag`, peor p99 del run:

| | Gate 3 | Gate 4 | Límite de auditoría |
|---|---|---|---|
| spot | 19.8 ms | **19.0 ms** | 20 ms |
| usdm | 19.8 ms | **19.0 ms** | 20 ms |

Mejora del 4 %, contra el 23–29 % de las demás. **Y ambos rozan el límite: pasa
con un 5 % de margen.**

Es la próxima grieta. Mientras `book_apply` pasó de estar un 48 % por encima de
su límite a un 45 % por debajo, `event_loop_lag` sigue pegado al techo. En un
gate de 24 h, con más ventanas y más oportunidades de pico, **es lo primero que
va a romper**. Queda anotado como pendiente: uvloop no lo resuelve, hace falta
entender de dónde salen esos 19 ms.

---

## 5. Decisión y siguiente paso

**Se conserva el cambio.** Justificación: no rompe nada (4/4 auditorías,
identidad 1.0, 0 conflictos, salida limpia rc=0, 0 parciales), no tiene coste,
degrada con elegancia si uvloop faltase, y los números apuntan todos en la misma
dirección.

**La prueba que sí zanjaría el asunto** sigue pendiente y requiere orden del
operador: dos procesos en paralelo sobre el mismo flujo de Binance, misma hora,
uno con uvloop y otro sin, comparados 48 h. Con el mercado idéntico para ambos,
el confusor desaparece por construcción en vez de por argumento.

Antes de eso hay que resolver `planes/BLOQUEADOR_DISCO_7DIAS.md`: dos capturas
de 48 h en CSV son ~360 GiB y solo hay 120 GiB libres.
