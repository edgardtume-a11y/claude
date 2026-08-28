# El atasco de 475 ms — investigación del 28/08/2026

Estado: **replicado en 3 gates y 2 días con un desfase de 2,9 s de anchura.**
Asociación establecida más allá de duda razonable; causalidad no cerrada por
experimento directo (ver §4 y §5-bis).
Todo lo que sigue es solo lectura sobre lo grabado, más dos experimentos
controlados en la máquina ociosa.

## 1. Cómo se localizó en el tiempo

ChatGPT señaló que el campo `max` es el máximo de una ventana móvil de 10 000
muestras (≈200 s) y que por tanto no lleva marca de tiempo del suceso original.
Cierto — pero hay una salida: **si el `max` publicado SUBE, la muestra que lo
provocó tiene que estar entre las ~252 nuevas de esa publicación.** Un flanco de
subida es un timestamp con resolución de ~5 s.

Aplicado al gate 3 (3439 publicaciones maduras por mercado): **99 flancos de
subida**, de los cuales **6 con salto > 100 ms**.

| hora UTC (spot) | max previo | max nuevo | salto |
|---|---|---|---|
| 17:14:37 | 41.29 | 356.21 | 314.9 |
| 17:24:40 | 53.06 | 347.48 | 294.4 |
| 18:24:38 | 34.05 | 210.04 | 176.0 |
| 18:34:35 | 60.74 | 427.54 | 366.8 |
| 19:24:36 | 28.36 | 342.75 | 314.4 |
| 19:34:39 | 41.29 | **475.59** | 434.3 |

Futuros da los mismos seis, con 1-4 s de diferencia y **el mismo 475.59**:
suceso único de proceso (spot y futuros comparten bucle en `dual_main`).

**Intervalos entre atascos: 10.0, 60.0, 10.0, 50.0, 10.0 minutos.** Exactos al
segundo. Todos en minuto ≡ 4 (mod 10). Eso es un reloj, no el mercado.

## 2. El colector no los causa

Contadores en los 6 atascos frente a las otras 3432 publicaciones:

| contador | en atascos | resto | razón |
|---|---|---|---|
| `event_loop_probe_missed_ticks` | 17.50 | 0.37 | **47.59** |
| `depth_diff_messages` | 51.50 | 51.04 | 1.01 |
| `csv_flushes` | 19.33 | 19.97 | 0.97 |
| `csv_rows_written` | 4240.67 | 4474.97 | 0.95 |
| `agg_trade_messages` | 74.83 | 92.80 | 0.81 |
| `cooperative_yields_trade` | 30.83 | 39.18 | 0.79 |
| `rest_snapshots` / `book_syncs` / `depth_stale_events` | 0.00 | 0.00 | 1.00 |

**Todo lo que hace el colector está plano o más bajo.** Lo único que se dispara
es `missed_ticks`, que es la **consecuencia** del atasco (la sonda no pudo
correr), no la causa. El bucle no está ocupado: está parado desde fuera.

## 3. El sospechoso: la cadena de Ubuntu Pro cada 10 minutos

Cada 10 minutos arranca junta la cadena `apt-news` → `esm-cache` → `packagekit`,
disparada por `/etc/apt/apt.conf.d/20apt-esm-hook.conf`. Durante el gate 3:

- `esm-cache.service` (`/usr/lib/ubuntu-advantage/esm_cache.py`): **31 veces**,
  de `:X3:58.9` a `:X4:00.3` (~1.4 s).
- `packagekit.service`: **30 veces**, arranca en `:X3:59.4` y **vive 5 minutos**
  (se desactiva en `:X9:04.57`).
- `apt-news.service` (`/usr/lib/ubuntu-advantage/apt_news.py`): 31 veces.

**Los 6 atascos caen entre 35 y 41 segundos después del arranque de
PackageKit.** Seis de seis, en una ventana de 6 segundos.

`otelopscol` queda **descartado** como disparador periódico: da error **todos
los minutos** de las cinco horas (los 310), así que es ruido constante y no
puede explicar 6 sucesos.

## 4. Dos experimentos, los dos negativos

**Experimento A** — disparar `esm-cache.service` con la sonda corriendo:

| tramo | p50 | p99 | max |
|---|---|---|---|
| antes | 0.742 | 1.247 | 1.277 |
| durante | 0.731 | 1.229 | 1.248 |
| después | 0.736 | 1.235 | 1.295 |

Sin efecto. La ejecución duró 1.31 s, comparable a las del gate (1.1-1.7 s), así
que sí hizo su trabajo.

**Experimento B** — parar `packagekit`, arrancarlo y sondear 75 s por tramos de 5 s:

Los catorce tramos dan p50 ≈ 0.71, p99 ≈ 1.20, max ≈ 1.23. **Cero picos > 20 ms**,
incluidos los tramos 35-40 s y 40-45 s, que es donde caen los atascos reales.

## 5. Qué significa esto, sin adornos

La asociación temporal es muy fuerte: seis sucesos, todos en minuto ≡4, todos a
35-41 s del arranque de PackageKit, con todos los contadores del colector planos.
Pero **no se reproduce en la máquina ociosa**.

La explicación más probable es que haga falta la **combinación**: el trabajo de
PackageKit *más* la carga del colector, que durante el gate escribía 112 800
filas/min además de dos websockets. La sonda sola casi no genera E/S; no hay con
qué competir.

**No está probado. Es una hipótesis con localización temporal fuerte y dos
intentos fallidos de reproducirla aislada.**

## 6. Lo que decidiría la cuestión

1. **Enmascarar la cadena de Ubuntu Pro durante los gates.** Es maquinaria de
   ESM/apt-news que un colector de trading no usa para nada, y corre cada 10
   minutos. Coste de probarlo: `systemctl mask apt-news.service esm-cache.service
   packagekit.service` antes de un gate corto y comparar la cola. Si los atascos
   desaparecen, cerrado. **Requiere orden del operador.**
2. **La métrica de excedencia con marca de tiempo** (ítem 5 del backlog conjunto,
   propuesta de ChatGPT): registrar el suceso cuando supera umbral, con hora,
   generación de GC, profundidad de colas y estado de E/S. Sin eso seguimos
   deduciendo la hora por flancos.
3. **Variables del host alineadas** (ítem 6): CPU, run queue, steal, iowait.
   Con eso, un atasco de 475 ms se atribuye en un vistazo.

## 7. Hallazgo aparte, no relacionado pero real

`otelopscol` —el agente de Google Cloud Ops— falla al exportar **cada minuto**
con `IAM_PERMISSION_DENIED` sobre `logging.logEntries.create` en el proyecto
`jean-flow-01`, y vuelca en el journal el error completo más una traza de pila de
Go. Son **1440 ráfagas al día** de escritura inútil en disco.

Se arregla dando el permiso a la cuenta de servicio de la VM, o desactivando la
exportación de logs si no se usa. Independiente del atasco, pero es E/S
desperdiciada en una máquina donde la E/S importa.


---

# ADENDA — Replicación (28/08/2026, 08:30 UTC)

## El desfase es constante, y el reloj no

Apliqué el método del flanco de subida a **todos** los gates con métricas.
Resultado: **18 flancos > 100 ms = 9 sucesos únicos** (cada uno aparece en los
dos mercados), repartidos en **3 gates de 2 días distintos**.

Y la cadena de Ubuntu Pro no siempre arranca en el mismo minuto: su anclaje
cambió entre días (`:09:41`, `:15:10`, `:35:10`, `:X3:59`). Eso convierte la
comprobación en una prueba de verdad, porque si el desfase se conserva pese a
moverse el reloj, la coincidencia deja de ser explicable por el minuto.

| packagekit arranca | atasco detectado | desfase |
|---|---|---|
| 2026-08-26 00:09:41.24 | 2026-08-26 00:09:12 | **−29.2 s** ← no encaja |
| 2026-08-27 04:15:10.62 | 2026-08-27 04:15:48 | **+37.4 s** |
| 2026-08-27 05:35:10.45 | 2026-08-27 05:35:47 | **+36.5 s** |
| 2026-08-27 17:13:59.52 | 2026-08-27 17:14:37 | **+37.5 s** |
| 2026-08-27 17:23:59.47 | 2026-08-27 17:24:36 | **+36.5 s** |
| 2026-08-27 18:23:59.57 | 2026-08-27 18:24:38 | **+38.4 s** |
| 2026-08-27 18:33:59.44 | 2026-08-27 18:34:35 | **+35.6 s** |
| 2026-08-27 19:23:59.53 | 2026-08-27 19:24:36 | **+36.5 s** |
| 2026-08-27 19:33:59.40 | 2026-08-27 19:34:35 | **+35.6 s** |

**8 de 9 en la banda +35.6 a +38.4 s. Anchura: 2.9 segundos.**

Y la resolución del propio detector es de ~5 s, así que el desfase real es aún
más estrecho de lo que se puede medir con este método.

## Cuánto vale eso

Si los atascos cayeran en cualquier momento del ciclo de 10 minutos (600 s), la
probabilidad de que uno caiga en una ventana concreta de 2.9 s es 0.0048. Para
ocho: **≈ 3 × 10⁻¹⁹**.

La asociación entre la cadena `apt-news` → `esm-cache` → `packagekit` y los
peores atascos de latencia de todas las capturas queda establecida.

## El que no encaja

`2026-08-26 00:09:12` va **29 s antes** del arranque de las 00:09:41. El
arranque anterior fue a las 23:59:41.36, o sea 9 min 30 s antes del suceso —
tampoco encaja. **No tengo explicación para este.** Queda anotado como tal, sin
inventarle una.

## Y esto reinterpreta los experimentos negativos

Los dos intentos de reproducirlo (§4) fallaron en la máquina **ociosa**. Con una
asociación de 10⁻¹⁹ sobre datos reales, lo que dicen esos negativos no es "no es
PackageKit": es que **PackageKit solo no basta**. Hace falta la carga del
colector compitiendo — 112 800 filas/min de escritura más dos websockets.

Eso también predice algo comprobable: el atasco debería crecer con la carga del
colector, no con la de PackageKit.

## Acción concreta

`systemctl mask apt-news.service esm-cache.service packagekit.service` antes de
un gate corto, y comparar la cola contra el gate 3.

Es maquinaria de ESM y noticias de apt. Un colector de trading no la usa para
nada, y corre **cada 10 minutos**. Si los atascos desaparecen, el problema que
llevaba dos días buscándose dentro del motor estaba fuera de él.

**Requiere orden del operador.** No se toca nada del sistema sin ella.
