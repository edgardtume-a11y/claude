# El gate «postmask» del 28/08: por qué falló la certificación

**Fecha del análisis:** 28/08/2026, 17:45 UTC
**Captura:** `20260828T155419Z_tokyo_postmask_gate_30m`, 15:54 → 16:55 UTC (61 min)
**Lanzada por:** el operador, a través de RDC
**Resultado:** `{"journal_spot":0,"journal_usdm":0,"identity":0,"metrics":2}`

Tres de cuatro fases pasan. **Falla `metrics`.**

---

## 1. Qué falló, exactamente

Siete umbrales, todos de latencia:

| Mercado | Métrica | Peor ventana | Límite | Última ventana |
|---|---|---|---|---|
| spot | `book_pipeline_p99` | 5.481 | 5.0 | — |
| spot | `event_loop_lag_p99` | 22.295 | 20.0 | — |
| spot | `writer_yield_p99` | 5.837 | 5.0 | — |
| usdm | `book_apply_p99` | **7.989** | 5.0 | 4.97 ✅ |
| usdm | `book_pipeline_p99` | **8.834** | 5.0 | 5.657 |
| usdm | `event_loop_lag_p99` | **22.385** | 20.0 | 4.843 ✅ |
| usdm | `writer_yield_p99` | 5.817 | 5.0 | 3.4 ✅ |

`parse_p99` pasa en los dos mercados con holgura.

**Dato importante: las últimas ventanas pasan con margen.** No es un sistema que
se degrada y se queda roto: son **ventanas atípicas** dentro de 692. Y la
exclusión de calentamiento **sí se aplicó** (120 s, 24 ventanas excluidas) — no
es el error que cometí en su día con los 19 ms.

---

## 2. Dos hipótesis mías, las dos equivocadas

Las dejo escritas porque el proceso de descartarlas es el valor.

### Hipótesis 1: «corrió sin uvloop ni gc.freeze». **FALSA.**

`dual_main.py` es **idéntico** al del gate 4 certificado — misma huella
`67ac0d90ce547ff3` en los tres stagings. Y el log del arranque lo confirma:

```
event_loop=uvloop
gc_frozen=41660
```

### Hipótesis 2: «cambió la forma de medir, el número no significa lo mismo». **TAMPOCO.**

Es verdad que el SLI legacy pasó de `loop.time()` a `perf_counter_ns`. Pero
esta versión publica **además** `event_loop_lag_loop_clock_diagnostic`, que usa
**la misma fórmula que el gate 4**. Y marca **22.0 ms**, no 3.0.

Con la misma regla de medir, el número subió igual. La degradación es real.

---

## 3. Lo que sí cambió, y es enorme: el mercado

| | gate 4 (30 min) | postmask (61 min) | por minuto |
|---|---|---|---|
| spot, trades | 9 323 | 168 517 | 311 → **2 762** (×9) |
| usdm, trades | 10 554 | 269 061 | 352 → **4 411** (×12) |
| spot, depth | 17 986 | 35 844 | ×1 (proporcional) |
| usdm, depth | 17 649 | 35 138 | ×1 (proporcional) |
| **usdm, resincronizaciones** | **1** | **22** | |
| **usdm, snapshots REST** | **1** | **27** | |

El libro llegó al mismo ritmo. **Los trades llegaron entre 9 y 12 veces más
rápido.** El gate 4 se midió en un mercado dormido; éste, en uno despierto.

Y la certificación se juega en **la peor de 692 ventanas**, no en la media. Con
el doble de duración y diez veces el flujo, la peor ventana es mucho peor por
construcción.

---

## 4. Lo que más me preocupa, y no son los p99

```
usdm_futures: failure_counters = {'book_invariant_failures': 8}
              book_boundary_hard_failures: 8, book_invariant_BookBoundaryError: 8
spot:         failure_counters = {'book_invariant_failures': 2}
```

**Diez violaciones de invariante del libro de órdenes**, y 22 resincronizaciones
en futuros contra 1 en el gate 4.

Los p99 son un criterio de calidad; una violación de invariante es el libro
diciendo que no cuadra. `journal` e `identity` certificaron igualmente —así que
el dato es reconstruible y la cadena causal está entera— pero para una captura
de 7 días esto importa más que unos milisegundos: **hay que saber si esas 10
son consecuencia del volumen o de otra cosa.**

---

## 5. Lo que NO he establecido

No sé separar todavía tres causas posibles de los p99:

1. **La carga del mercado** (×9-12 en trades). La explicación más probable.
2. **La instrumentación nueva.** Este linaje añade 105 líneas a `collector.py`,
   265 a `metrics.py` y 285 a `audit.py`: captura de excedencias de lag con
   contexto. Está limitada a 1 muestra/segundo y sólo actúa por encima del
   umbral, así que debería ser barata — pero *debería* no es *es*.
3. **La tormenta de resincronizaciones**, que puede ser causa o efecto.

**La prueba que lo separa:** correr el mismo gate de 60 minutos sobre el staging
`20260828T143727Z_auditparquet` —que lleva el `collector.py` del gate 4 más lo
de hoy, sin la instrumentación postmask— a una hora de mercado parecida, y
comparar. Si los p99 siguen altos, es la carga. Si bajan, es la instrumentación.

Mientras no se haga esa prueba, **cualquier afirmación sobre la causa es una
suposición**, incluida la mía de que es el mercado.

---

## 6. Lo que esto significa para los 7 días

No es una mala noticia disfrazada: es información que hacía falta.

- El gate 4 certificó **en un mercado dormido**. Como línea base para una
  captura de 7 días, era optimista: siete días incluyen sesiones agitadas por
  definición.
- Los límites actuales (5 ms de `book_apply`, 20 ms de bucle) puede que sean
  correctos y el sistema deba mejorar; o puede que estén calibrados contra un
  mercado tranquilo. **Eso es una decisión, y es del operador.**
- Lo que no se puede hacer es lanzar 7 días asumiendo que van a certificar
  porque el gate 4 certificó. **Ese gate no probó lo que parecía probar.**

Y esto es exactamente lo que sirven los gates: descubrirlo en 61 minutos en vez
de en el día seis.
