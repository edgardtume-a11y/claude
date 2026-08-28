# Hallazgos del 28/08/2026 — el instrumento y los linajes

Sesión de Claude Code por Remote Desktop Commander sobre `jean-flow-02-tokyo`,
en diálogo con ChatGPT conectado a la misma máquina. Canal en
`/home/trading/dialogo_ia/` (carpeta inerte; ningún proceso la lee).

Todo lo que sigue es **medida sobre datos ya grabados y lectura de código**.
Nada se lanzó, ninguna captura corrió.

---

## 1. El puente GitHub estuvo 29 minutos caído por un bucle auto-infligido

La orden `acelerar-001` ejecutaba `sed` + `systemctl restart puente-github`:
mataba al guardián que la estaba ejecutando, a mitad de orden. Al rearrancar
veía la orden sin resultado, la repetía, y se volvía a matar. **Cinco ciclos en
dos segundos** hasta `start-limit-hit`.

Restablecido a las 06:11 con `reset-failed` + `start`. Al revivir ejecutó la
única orden pendiente, `parar-todo-001` (parar los respaldos), con rc=0.

**Arreglado estructuralmente** — ver §5.

---

## 2. La grieta de los 19 ms era la muestra de CALENTAMIENTO

La premisa heredada era: *"`event_loop_lag` p99 clavado en 19 ms contra un
límite de 20, pasa con un 5 % de margen"*. Es falsa, y el motivo es concreto.

### Cómo se publica realmente esta métrica

**Lectura de código.** `collector.py:126` instancia `Metrics()` sin argumentos;
`metrics.py:48` tiene `latency_window: int = 10_000` y las observaciones son
`deque(maxlen=latency_window)`. `snapshot()` **copia sin vaciar**.

**Medida, gate 3 spot:**

| publicación | count | count_total | evicted | p99 |
|---|---|---|---|---|
| **#0** | **247** | 247 | 0 | **19.771** |
| #1 | 497 | 497 | 0 | 5.603 |
| #38 | 9792 | 9792 | 0 | 2.332 |
| #39 | 10000 | 10044 | 44 | 2.289 |
| #3477 | 10000 | 885 793 | 875 793 | 4.428 |

La ventana se llena en la publicación **#39**. A partir de ahí entran 252
muestras nuevas entre publicaciones consecutivas: **97.5 % de solape**. El
horizonte real es **10 000 / 50 = 200 s**, publicado cada 5 s.

**Los 3478 puntos no son ventanas independientes de 5 s.** Es una ventana móvil
de 200 s. (Corrección: en un análisis previo se leyó la publicación #0 —
`count=247, evicted=0`— y se generalizó a todas. Era la línea de calentamiento.)

### El 19 es la publicación #0

| gate · mercado | p99 máx **todas** | p99 máx **calentamiento** | p99 máx **maduras** | mediana maduras | maduras en [18,20) |
|---|---|---|---|---|---|
| gate 3 · spot | 19.771 | **19.771** (#0, count=247) | **10.895** | 4.617 | **0** |
| gate 3 · futuros | 19.759 | **19.759** (#0, count=247) | **10.886** | 4.663 | **0** |
| gate 4 · spot | 19.000 | **19.000** (#0) | **3.000** | 3.000 | **0** |
| gate 4 · futuros | 19.000 | **19.000** (#0) | **3.000** | 3.000 | **0** |

**En los cuatro casos el famoso 19 es la primera publicación**, un p99 sobre
247 muestras durante el arranque del proceso. Excluyendo el calentamiento —que
es lo que `audit.py` ya hace: *"[2.3.9] Exclusión de CALENTAMIENTO explícita del
gate de p99"*— el peor p99 maduro del gate 3 es **10.9 ms**. Contra el criterio
de grado servidor de 20, eso es un **45 % de margen, no un 5 %**.

Precisión sobre el límite: la constante que aplica el gate es
`EVENT_LOOP_P99_LIMIT_MS = 40.0` en `audit.py`, subida desde 20 y documentada
solo por el cuanto de 15.625 ms de Windows. El 20 es el criterio de grado
servidor, no el corte que ejecuta el auditor.

## 2-bis. La cola real: medio segundo, y nadie la miraba

El campo `max` publicado es también el máximo de la ventana móvil de 10 000
muestras. **Medida, gate 3, solo ventanas maduras:**

| | mediana | p95 | **máximo** |
|---|---|---|---|
| gate 3 (ambos mercados) | 46.3 | 342.75 | **475.59** |
| gate 4 (ambos mercados) | 24.0 | 42.0 | 42.0 |

Decir "máximos de 45.7 ms" era impreciso: 45.7 es la **mediana de los máximos
móviles**. La cola llega a **475.59 ms** — medio segundo de bucle parado, diez
veces mayor que el fantasma que se estaba persiguiendo.

Los dos mercados dan **exactamente el mismo 475.59**, lo que confirma que es un
suceso único de proceso: spot y futuros comparten bucle (`dual_main`).

**Este es el problema real, y estaba tapado por el 19.** No es interpretable
causalmente con los agregados actuales: el máximo persiste dentro de la ventana
móvil sin marca de tiempo del suceso original. Hace falta la métrica de
excedencia con timestamp (ítem 5 del backlog).

## 3. uvloop cambió el instrumento de medida

`loop.time()` bajo uvloop **no es un reloj**: es el instante del tick del bucle,
cacheado, en milisegundos enteros (libuv `uv_now()`).

**Medido** en el venv del colector, 2000 lecturas seguidas:

| | valores distintos / 2000 | incremento mínimo | lecturas en ms enteros |
|---|---|---|---|
| asyncio | **2000** | 0.000095 ms (95 ns) | 0 % |
| uvloop 0.22.1 | **1** | — | **100 %** |

En los datos reales del gate 4: **1424 de 1424 valores enteros** (100 %). En el
gate 3, 25 de 27 824 (0.1 %).

**El gate 3 midió con 95 ns y el gate 4 con 1 ms cacheado.** El A/B cambió el
tratamiento y el instrumento a la vez.

### Lo que NO está contaminado

`loop.time()` aparece en **tres líneas del código, las tres dentro de la sonda
de lag**. `book_apply`, `book_pipeline_total` y `parse` usan
`time.perf_counter_ns()`, que uvloop no toca, y su entrada (la profundidad) fue
idéntica entre gates. **Las mejoras del 23-29 % que certificaron el gate 4 se
sostienen. La decisión sobre uvloop es correcta.**

---

## 4. El A/B del gate 4 tenía el argumento invertido

La defensa era: *"`depth_diff_messages` fue idéntico al 0.1 %"*. Cierto, pero
esa es la variable que **no influye**.

- La profundidad llega **cada 100 ms por protocolo**: CV = **0.01**. Es un
  metrónomo. En el decil de peor lag da exactamente **1.00**.
- Los trades sí varían (CV 1.28-1.43) y sí se asocian: **1.68× spot / 1.57×
  futuros** de enriquecimiento en el decil superior de lag.
- Y en el gate 4 los trades cayeron **−72 % (spot) / −75 % (futuros)**.

Se comparó igualdad en la variable irrelevante mientras la relevante se
desplomaba.

### Sobre la hipótesis de saturación (H5)

Primera lectura: con el regresor correcto, Spearman +0.235 (gate 3). **Pero esa
cifra estaba mal planteada**, por lo mismo de §2: el p99 representa 200 s y los
deltas de trades eran de 5 s. Tratamiento y resultado no compartían horizonte.

Realineando los trades al horizonte del p99 (ChatGPT, exploratorio), y con
bloques **no solapados** de 40 publicaciones (n=85 por mercado):

| | 5 s (mal alineado) | ≈200 s (alineado) | bloques no solapados |
|---|---|---|---|
| gate 3 · spot | 0.247 | 0.461 | **rho 0.480** |
| gate 3 · futuros | 0.244 | 0.450 | **rho 0.463** |

**Esto reabre parcialmente H5.** La asociación es moderada, no débil. No prueba
"bucle saturado" ni explica toda la varianza —faltan controles por tendencia,
host y sucesos internos—, pero invalida la lectura de que el efecto era
necesariamente débil. (El gate 4 no sirve aquí: reloj contaminado y pocas
ventanas efectivas.)

Lo que sí sigue en pie: **"un proceso por mercado" no está justificado hoy**.
La profundidad da 1.00 y los extremos no se explican por la carga.

La distribución es bimodal (p95 ≈ 2 ms, máximos 45.7 ms) → sucesos internos
discretos. `csv_flushes` está plano (1.00 y 0.98), lo que **descarta el `fsync`**
como sospechoso principal. Candidato sin contador: el GC generacional.

Aviso de método: el contraste por deciles vale como **exploración**, no como
prueba, y además se calculó sobre publicaciones con 97.5 % de solape. Los contadores son acumulativos, el umbral se eligió a posteriori, la
serie de 5 s tiene autocorrelación, y coincidir en la ventana no establece
orden temporal. `book_syncs` 2.18 y `rest_snapshots` 1.89 en futuros son ruido
de conteos minúsculos (0.01-0.05 sucesos/ventana), descartados.

---

## 5. Tres linajes de código, un solo número de versión

| sha256 | líneas | fecha | dónde |
|---|---|---|---|
| `7672118b` | 1433 | 13/08 | el venv instalado — **obsoleto, no es el que graba** |
| `e4210555` | 1934 | 26/08 | **los 9 gates del 27/08**, gate 3 y gate 4 incluidos |
| `8aeb1597` | 1945 | — | `gate3_perf`, tercer variante |

Los tres declaran `__version__ = "2.4.1+linux.1"`. Diferencia entre el
instalado y el de los gates: **537 líneas añadidas, 36 cambiadas, 0
eliminadas**; cinco métodos que solo existen en el de los gates
(`_publish_trade_view`, `_record_dashboard_publish`, `_log_book_failure`,
`_record_hot_rebase_failure`, `_request_preventive_rebase`).

**Riesgo que esto creaba:** el linaje bueno solo existía dentro de directorios
de staging, que el sistema trata como desechables — y la noche del 27 hubo una
campaña de borrado por falta de disco. Un `rm -rf` de staging antiguos y se
perdía el código de producción.

También: un parche aplicado al paquete instalado (el sitio natural, el que
resuelve `import binance_collector`) **habría sido un no-op** para los gates.

### Auditoría del resto de servicios

Método: PID → `/proc/PID/cmdline` → `cwd` → hash del `.py` ejecutado → todas
las copias del mismo nombre.

| componente | huella | copias | veredicto |
|---|---|---|---|
| `jean-flow-router` | `4afc18e8` (946 lín.) | 2, idénticas | limpio |
| `jean-flow-gemini` | `953ee3eb` (608 lín.) | 2, idénticas | limpio |
| `puente-github` | `11f33eb7` (283 lín.) | 1 | limpio |
| `jean-flow-unrestricted` | `4ed1e7ed` (530 lín.) | 2 idénticas + 4 de otra generación | limpio |
| `jean-flow-bridge` | `fc6143c0` (3626 lín.) | **1, dentro de `import_backup/`** | frágil |

**Cuatro de cinco limpios.** La ambigüedad es del colector.

### Controles del agente unrestricted: ya existían

Se iban a proponer autenticación, expiración y anti-replay. Los tres estaban
implementados en `exec_agent.py` (`4ed1e7ed`):

| control | línea |
|---|---|
| `hmac.compare_digest` (tiempo constante) | 214 |
| longitud mínima de token (32) | 178-179 |
| `expires_at` obligatorio **con zona horaria** | 185-189 |
| tope de futuro `JOB_MAX_FUTURE_SECONDS` | 195 |
| anti-replay (`FileExistsError`) | 430 |
| campos cerrados (`ALLOWED_FIELDS`) | 67-68 |

Sigue siendo cierto que `action: "sudo"` da `sudo -n bash -lc` y que el `sudo -n`
sin contraseña está activo: la frontera de privilegio es la cuenta del sistema,
como dice su propia docstring. Diseño consciente.

**Es la segunda vez en dos días que se propone algo ya implementado.** La regla
que falta: antes de proponer, un `grep` del concepto. Treinta segundos.

---

## 6. Correcciones al handoff anterior

| punto | estado |
|---|---|
| nº12 "diagnóstico de los 19 ms" | **el 19 era la muestra de calentamiento** (publicación #0, 247 muestras) — §2 |
| — | **la cola real llega a 475.59 ms** y nadie la miraba — §2-bis |
| nº5 "uvloop apenas movió el lag (−4 %)" | **cambió el instrumento** — §3 |
| "el A/B se salva porque depth_diff fue idéntico" | **argumento invertido** — §4 |
| "un proceso por mercado" | **sin apoyo, eliminado** — §4 |
| veredicto del gate 4 (book_apply, −23/−29 %) | **se sostiene** — §3 |
