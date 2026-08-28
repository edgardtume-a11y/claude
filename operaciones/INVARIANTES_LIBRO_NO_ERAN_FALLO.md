# Las 10 violaciones de invariante no eran un fallo: era el sistema curándose

**Fecha:** 28/08/2026, 18:40 UTC
**Corrige:** mi propia valoración en `operaciones/GATE_POSTMASK_FALLO_ANALISIS.md`,
donde escribí que esto *«me preocupa más que los milisegundos»*.
**Conclusión: me equivoqué al ordenarlo así.** El dato está entero.

---

## 1. Lo que decía el informe del auditor

De `journal_usdm.json`, la captura de 61 minutos:

```
book_statuses:
  PREVENTIVE_REBASE ........ 13     <- rebase preventivo
  REBASE_IN_PROGRESS ....... 13
  HOT_REBASE_SWAPPED ....... 13     <- y completado en caliente
  INVALIDATED:invariant .....  8
  INVALIDATED:connection_end   1
  SYNCING ..................  9
  SYNCED ................... 22     <- recuperado 22 veces

delta_dispositions: {applied: 34 964, invalid: 8, stale: 166}
ingest_conflicts: 0 | snapshots: 22 | generation: 22
incomplete_markers: []
certification: causal_replay PASS | journal_integrity PASS | safe_for_visual_replay true
```

**8 deltas inválidos sobre 34 964 aplicados: el 0,023 %.**

Y cada uno terminó igual: el libro detectó que no cuadraba, se invalidó, pidió
un snapshot REST nuevo y volvió a sincronizar. **22 veces detectado, 22 veces
recuperado.** Trece de esos rebases fueron **preventivos**: el sistema no
esperó a romperse.

`ingest_conflicts: 0` y `incomplete_markers: []` — ni un dato perdido, ni un
fichero a medias.

---

## 2. Por qué pasó: el mercado se movió de verdad

Los detalles de fallo traen los precios:

```
15:58  best_bid 78 400.2   best_ask 78 400.3
16:14  best_bid 77 846      best_ask 77 846.01
```

**BTC cayó ~554 dólares en 16 minutos, un 0,7 %.** Y el libro quedó torcido:
en el fallo de las 16:14, **9 602 niveles de venta contra 2 742 de compra**. Es
la huella de una venta fuerte comiéndose el lado comprador.

Eso explica de una vez las dos cosas que veía por separado:

- los trades multiplicados por 9-12 respecto al gate 4,
- y las violaciones de invariante, que se agolpan justo cuando el libro cambia
  más deprisa.

No fue «un rato con más volumen». Fue un movimiento real.

---

## 3. En qué me equivoqué

Escribí que 10 violaciones de invariante me preocupaban más que los p99. Lo
escribí **antes de leer los estados del libro**, con sólo el contador de
`failure_counters`.

Un contador que se llama `book_invariant_failures` suena a rotura. Pero el
informe del auditor, que estaba a una consulta de distancia, dice que cada una
fue detectada, aislada y recuperada, y que el resultado certifica. **Juzgué por
el nombre de un contador en vez de por el informe.**

Es el mismo patrón que ya me costó caro con los 19 ms: **alarmarme por un
número antes de mirar qué mide.** La diferencia es que esta vez lo comprobé
antes de que costara una decisión.

---

## 4. Lo que sí queda, y esto sí importa para el objetivo

No para la captura: **para el entrenamiento.**

Hubo **22 resincronizaciones en una hora** de mercado movido. En 7 días con
sesiones agitadas habrá muchas. Cada una es una **frontera de época**: el libro
antes y después del resync no es el mismo objeto continuo, y el propio auditor
lo dice —*«cada gap/resync debe dibujarse como frontera de epoch»*.

**Consecuencia práctica:** al construir las características para el modelo, no
se puede calcular una ventana que cruce una frontera de época como si nada
hubiera pasado. Un indicador de 30 segundos que abarque un resync mezcla dos
libros distintos y produce una señal inventada.

Eso hay que dejarlo escrito ahora, mientras se ve, y no descubrirlo cuando el
modelo dé resultados raros y nadie sepa por qué.

Y se une a lo que ya sabíamos del embargo:
**embargo = máximo periodo de las características + horizonte de predicción**,
y ahora además: **ninguna ventana cruza una frontera de época.**

---

## 5. Estado

- La captura del operador **no certificó** por 7 umbrales de latencia
  (ver `GATE_POSTMASK_FALLO_ANALISIS.md`). Eso sigue en pie.
- **Los datos que capturó están íntegros**: `journal` e `identity` certifican,
  cero conflictos, cero marcadores incompletos.
- Las violaciones de invariante **no son un motivo para no lanzar los 7 días**.
- La prueba comparativa —mismo gate sobre `20260828T143727Z_auditparquet`, a
  una hora de mercado parecida— sigue siendo lo que separa carga de
  instrumentación. Requiere orden del operador.
