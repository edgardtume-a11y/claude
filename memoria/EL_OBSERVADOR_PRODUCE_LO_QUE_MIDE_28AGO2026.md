# La publicación de métricas produce el 99 % de las excedencias que reporta

28/08/2026 · gate post-máscara · el hallazgo más importante de la investigación

## En una frase

**El 99.1 % de las excedencias de latencia ocurren a menos de 0.25 s de una
publicación de métricas**, y publicar cuesta ~7.4 ms por mercado con la ventana
llena — unos 15 ms síncronos por ciclo, contra un umbral de excedencia de 20 ms.
`event_loop_lag` está midiendo, en parte, el coste de medirlo.

## Cómo se llegó

Por un error propio. Escribí una sonda para comprobar si un proceso vacío también
se atasca. Dio atascos crecientes: 3.2 → 7.4 → 15.5 → 25.1 → 35.2 → 41.1 ms.

Los momentos: **t = 180.0, 240.0, 300.0 s. Exactamente cada 60 segundos.** Que es
cuando la sonda imprimía su informe periódico, haciendo `sorted()` sobre una lista
que crece 60 000 elementos por minuto, **dentro del bucle**.

No era la máquina. Era el instrumento atascando lo que medía. La pregunta
obligada fue: **¿le pasa lo mismo al colector?**

## La asociación

Gate post-máscara, spot, 692 publicaciones, 438 excedencias con reloj UTC.
Desfase de cada excedencia a la publicación más cercana:

```
  -1.04..-0.52 s   1
  -0.52..+0.00 s   5
  +0.00..+0.52 s   431   ############################################################
  +2.08..+2.60 s   1
```

**434 de 438 = 99.1 %** a menos de 0.25 s. Mediana del desfase absoluto 0.113 s.
Bajo reparto uniforme en el ciclo de 5.2 s se esperaría **9.6 %**.

## No es circular

`metrics.py`: `observed_utc_ns` **se recibe como parámetro** de quien observa; no
se sella al escribir el evento ni al publicar. El sello es del instante de
observación. Si se sellara al publicar, todo esto sería un artefacto.

## El mecanismo

`observe_event_loop_lag()` toma `self._temporal_lock` para registrar.
`_snapshot_temporal()` toma **el mismo candado** y copia las estructuras dentro
de él. Quien registra el lag espera a que la copia termine.

Coste medido, mismo intérprete, ventana llena a 10 000 muestras:

| operación | mediana | p95 | max |
|---|---|---|---|
| `snapshot()`, ventana vacía | 0.008 ms | 0.020 | 0.037 |
| `snapshot()`, 2 500 muestras | 1.138 ms | 1.189 | 1.684 |
| `snapshot()`, 10 000 muestras | **7.398 ms** | 7.855 | 8.835 |
| `json.dumps(snapshot)` | 0.043 ms | 0.084 | 0.140 |

Escala **lineal con el llenado**. El JSON es despreciable: el coste es copiar la
ventana rodante bajo el candado. Producción publica **dos mercados por ciclo**.

## Qué explica y qué no

**Explica:** el grueso de las 800 excedencias, su agrupación al 99.1 % en la
publicación, y por qué el banco sintético nunca las reprodujo — **el banco no
llama a `snapshot()` ni una vez**. Esa era la pieza que faltaba, y no era la
decodificación JSON ni los dos mercados.

También explica el resultado de la ablación: ninguna etapa de trabajo subía
porque el atasco **no está en ninguna etapa de trabajo**, está en medir.

**No explica el suceso de 584 ms.** Quince milisegundos están dos órdenes de
magnitud por debajo. Ese sigue abierto y no se atribuye.

## Reserva

Es **asociación temporal fuerte más un coste medido compatible**, no demostración
causal. Lo que la cerraría: misma versión, publicación a 5 s contra 30 s. Si las
excedencias caen proporcionalmente, queda demostrado. Es un gate y requiere orden
del operador.

## Propuesta, no aplicada

El coste escala con el llenado porque se copia la ventana entera. Dos opciones:

1. **Percentiles incrementales** en vez de copiar y ordenar al publicar. Coste
   constante.
2. **Copiar fuera del candado**: tomar la referencia bajo candado, intercambiar
   la estructura, procesar la copia sin bloquear a quien registra.

La segunda es menos invasiva y ataca lo que duele: no el coste en sí, sino que
ocurra **con el candado tomado**.

## La lección

Ya se sabía que un banco que no reproduce el fenómeno no absuelve a nadie. Este
hallazgo añade la hermana: **un instrumento que produce el fenómeno tampoco
acusa.** Las cifras del gate no son falsas, pero incluyen al observador.
