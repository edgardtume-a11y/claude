# Auditar en paralelo: 2,35× más rápido, y con informes idénticos

**Fecha:** 28/08/2026, 20:05 UTC
**Medido sobre:** la captura real del operador
`20260828T155419Z_tokyo_postmask_gate_30m` — 61 minutos, 6,5 GB, 14 ficheros
**Resultado: FUNCIONA.** Sin tocar `audit.py`.

---

## 1. La medida

| | Serie (como se hace hoy) | Paralelo |
|---|---|---|
| `journal_spot` | 98,1 s | |
| `journal_usdm` | 230,1 s | |
| `identity` | 247,4 s | |
| `metrics` | 0,3 s | |
| **TOTAL** | **577 s (9 min 37 s)** | **245 s (4 min 5 s)** |

**2,35× más rápido.** Y lo que importa tanto como la velocidad:

```
journal_spot: IDENTICO  (9dfb0fa5f19ba42d)
journal_usdm: IDENTICO  (bc688b6c4ff0e732)
identity:     IDENTICO  (8ffff6be551f533a)
metrics:      IDENTICO  (c6424c41b860fb72)
```

**Los cuatro informes salen byte a byte iguales.** Paralelizar no cambia lo que
se certifica: sólo cuándo termina.

### El coste en máquina

```
pico de memoria: 1 616 MB de 32 090   (5 %)
pico de carga:   2,65 de 8 núcleos
```

Prácticamente nada. La preocupación de que cuatro procesos leyendo CSV grandes
compitieran **no se materializó**, y ahora está medida en vez de supuesta.

---

## 2. Por qué es seguro

No se toca `audit.py`. El cambio está en `control/run_live_audits.sh`, el guion
que lo llama: donde hoy hay cuatro líneas seguidas, van cuatro con `&` y un
`wait`.

Las cuatro fases son de **sólo lectura** sobre los CSV y escriben a **ficheros
distintos**. `journal_spot` y `journal_usdm` ni siquiera leen los mismos
ficheros. No hay estado compartido que pueda corromperse — y la prueba de
informes idénticos lo confirma en la práctica, no sólo en el razonamiento.

---

## 3. Dónde está ahora el cuello de botella

`identity`, con 247 s. Como el paralelo tarda lo que tarda la fase más lenta,
**el suelo son esos 247 s.** Bajar de ahí exigiría paralelizar `identity` por
dentro, y eso sí tocaría código certificado: no merece la pena todavía.

---

## 4. Lo que esto proyecta a los 7 días, y el riesgo que aparece

Esta captura es de 61 minutos. Siete días son **165 veces más**.

Si el tiempo escalara de forma lineal:

| | estimación |
|---|---|
| Auditoría en serie | **~26 horas** |
| Auditoría en paralelo | **~11 horas** |

Quince horas de diferencia. Eso ya justifica el cambio por sí solo.

### ⚠️ Pero hay algo que hay que comprobar antes, y no es el tiempo

La memoria se mantuvo plana en 1,6 GB durante 61 minutos. **Eso no garantiza
que se mantenga plana durante 7 días.**

El motivo de preocupación es concreto: `journal` detecta conflictos de
`ingest_seq`, y para eso tiene que **recordar los que ya vio**. El gate 4
reportó `unique_ingest_seq_count: 45 295` en 30 minutos de mercado dormido.
Con el mercado despierto de hoy, esa cifra es mucho mayor.

Si el auditor guarda un conjunto de identificadores que crece con la duración,
en 7 días serán **decenas de millones por mercado**, y en Python eso son
**varios GB**. `identity`, que carga los dos mercados a la vez, sería el
primero en sufrirlo — y en paralelo corre a la vez que los dos `journal`.

**Con 32 GB puede caber o puede no caber.** Y descubrirlo al final de una
captura de 7 días es descubrirlo en el peor momento posible.

**La prueba que hay que hacer, y es barata:** medir la memoria de `journal`
frente al número de filas en dos o tres capturas de tamaños distintos —las que
ya hay en disco sirven— y ver si la curva es plana o creciente. Si crece
linealmente con las filas, hay que resolverlo **antes** de lanzar los 7 días.

Es la misma disciplina de siempre: lo que se mide en una hora no se extrapola a
una semana sin comprobar qué crece.

---

## 5. Un error mío por el camino

La primera versión del banco medía mal. Puse la redirección de salida **fuera**
de la función que cronometraba:

```bash
medir "$PY" -m ... > salida.json      # mal
```

Así, la línea de tiempos que producía `medir` acababa **dentro del JSON del
informe**: ni se veía el tiempo, ni la comparación de informes habría valido
nada — habría comparado basura contra basura, y probablemente habría salido
«idéntico».

Lo vi al leer el log a medias, antes de que terminara. Corregido pasando el
fichero de salida como argumento a la función.

La lección: **un banco de pruebas mal instrumentado no da un error, da un
resultado**. Y un resultado falso que confirma lo que esperabas es lo más caro
que hay.
