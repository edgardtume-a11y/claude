# La memoria del auditor crece con las filas — y eso decide cómo se certifican los 7 días

**Fecha:** 28/08/2026, 20:55 UTC
**Medido sobre:** la captura del operador de 61 minutos, subconjuntos crecientes
**Conclusión: hay que certificar por días, no la semana de una vez.**

---

## 1. La medida

Cinco puntos, auditando subconjuntos crecientes de los mismos ficheros:

| Ficheros | Bytes | Filas (`unique_ingest_seq`) | Pico de memoria | Segundos |
|---|---|---|---|---|
| 1 | 0,54 GB | 39 134 | 69,1 MB | 24 |
| 2 | 1,07 GB | 75 536 | 78,7 MB | 48 |
| 4 | 2,15 GB | 146 594 | 97,8 MB | 96 |
| 7 | 3,76 GB | 265 037 | 131,0 MB | 169 |
| 10 | 5,04 GB | 339 229 | 156,2 MB | 231 |

**Recta perfecta:**

```
memoria ≈ 58 MB  +  290 MB por cada millón de filas
```

El tiempo también es lineal (24 s por fichero, sin desviarse).

**La sospecha era correcta: la memoria crece con las filas, no se queda plana.**
El auditor tiene que recordar los `ingest_seq` que ya vio para detectar
conflictos, y eso se acumula.

---

## 2. Por qué el veredicto automático del banco se queda corto

Mi propio guion imprimió **«CABE»**. Contestaba a: *¿cabe un `journal` de un
mercado?* Sí: ~16,6 GB de 32.

Pero ésa no es la pregunta. Las de verdad son dos, y las dos salen peor.

### `identity` carga los DOS mercados a la vez

Es su cometido: certificar la contigüidad global entre spot y futuros. Con las
filas de los dos:

| | filas estimadas en 7 días | memoria |
|---|---|---|
| `journal` usdm | ~57 M | ~16,6 GB |
| `journal` spot | ~38 M | ~11,1 GB |
| **`identity` (los dos)** | **~95 M** | **~27,6 GB** |

**27,6 de 32 GB, sin contar el sistema ni la caché de disco.** Eso no es
«cabe»: es «puede que no».

### Y en paralelo corren tres a la vez

El banco de esta tarde demostró que paralelizar da **2,35×** con informes
idénticos. Pero sobre 7 días serían simultáneamente:

```
journal_spot  ~11,1 GB
journal_usdm  ~16,6 GB
identity      ~27,6 GB
------------------------
              ~55 GB      en una máquina de 32 GB
```

**No cabe. Ni de lejos.**

Lo que esta tarde parecía una mejora limpia **es exactamente lo que reventaría
la certificación de los 7 días** si se aplicara sin pensar.

---

## 3. La salvedad honesta sobre las cifras

La estimación usa el ritmo de **la hora más movida** que hemos capturado: la
del desplome de 554 dólares, con los trades multiplicados por 9-12 respecto al
gate 4. Una semana normal tendrá horas mucho más tranquilas, así que el total
real estará **por debajo** — quizá la mitad.

Pero aunque sea la mitad, `identity` pediría ~14 GB y los tres en paralelo ~28:
**sigue siendo un riesgo que no se puede correr a ciegas al final de una semana
de captura.**

---

## 4. La salida, y encaja con lo que ya sabíamos

**Certificar por días, y cada día en paralelo.**

Un día a este ritmo son ~8,1 millones de filas por mercado:

| | memoria por día |
|---|---|
| `journal` de un mercado | **~2,4 GB** |
| `identity` de los dos | **~4,8 GB** |
| **Los tres en paralelo** | **~9,6 GB de 32** |

Holgado. Y con la ganancia de 2,35× intacta: **siete auditorías diarias en
paralelo, en vez de una semanal imposible.**

Lo bueno es que **esto ya estaba propuesto por otro motivo**. En
`planes/BLOQUEADOR_AUDITOR_NO_LEE_PARQUET.md`, la opción A era certificar por
días porque no cabían 628 GiB de CSV reconstruido en disco. Aquel problema se
resolvió enseñando al auditor a leer Parquet — pero **la partición por días
vuelve a hacer falta, ahora por memoria.**

Cuando dos análisis independientes llegan a la misma estructura, esa estructura
suele ser la correcta.

### Lo que hay que resolver aparte

Certificar por días deja **sin comprobar la continuidad entre días**: que el
último `ingest_seq` de un día enlaza con el primero del siguiente. Es una
comprobación pequeña —comparar dos números por mercado y frontera— y hay que
escribirla. Sin ella, siete certificados diarios no equivalen a un certificado
semanal.

---

## 5. La lección del banco que se contestó a sí mismo

Mi guion imprimió «CABE» y era verdad — para la pregunta que él se hacía.

Programé el veredicto pensando en `journal` de un mercado, y luego leí ese
veredicto como si respondiera por toda la auditoría. **Un banco de pruebas
contesta la pregunta que le programaste, no la que te importa**, y la respuesta
sale con la misma cara de autoridad en los dos casos.

Es el mismo patrón del banco de ayer, que medía mal por una redirección: la
diferencia es que aquél no daba número y éste sí. **Un número equivocado es más
peligroso que ninguno.**
