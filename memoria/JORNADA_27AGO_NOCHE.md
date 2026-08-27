# Jornada del 27/08/2026 — tramo de noche (19:30 – 22:00 UTC)

Continuación de `MEMORIA_JORNADA_27AGO2026_PARTE2.md`. Todo lo que sigue ocurrió
después del cierre del gate 3.

---

## 1. Gate 4: uvloop + `gc.freeze` — CERTIFICADO

**Orden del operador:** *"Las 3 mejoras (M1 GC, M2 writer, M3 uvloop) — con A/B obligatorio"*.

### Lo que cambió el plan

Al leer el código antes de encargar nada, **dos de las tres mejoras ya existían**:

- **M1** (umbrales del recolector de basura): ya en `latency.py`, con
  `(50000, 100, 100)` — más conservador que el `(50000, 50, 50)` propuesto — más
  `sys.setswitchinterval(0.001)`, que la auditoría ni mencionó, y con
  restauración al salir. Solo faltaba `gc.freeze()`.
- **M2** (troceo del escritor): ya existía con 64 filas. Y su otra mitad
  (`await asyncio.sleep(0)`) es **inaplicable**: el escritor es
  `threading.Thread`, no una tarea asyncio. No hay bucle al que ceder el turno.
  **M2 ANULADA.**
- **M3** (uvloop): la única real.

Detalle: el primer encargo a Gemini pedía las tres en dos archivos y **falló por
timeout a los 19 minutos**. Los archivos quedaron **intactos** (huella idéntica
al gate 3). Partido en un archivo y dos cambios, salió en **3.5 minutos**.

### El resultado

Cierre `engine_rc=0`, 0 parciales, 1.1 GB.

| Auditoría | Gate 3 | Gate 4 |
|---|---|---|
| journal_spot | 0 PASS | 0 PASS |
| journal_usdm | 0 PASS | 0 PASS |
| identity | 0 PASS | 0 PASS |
| **metrics** | **2 FALLA** | **0 PASS** |

Identidad: 89 767/89 767, ratio 1.0, 0 conflictos, 0 errores. Deltas de futuros:
17 649 aplicados, **0 obsoletos** (el gate 3 tuvo 170 obsoletos y 9 inválidos).

Peor p99 por ventana de 30 min, contra el **mejor** tramo de diez de la base:

| Métrica | Mejor base | Gate 4 | |
|---|---|---|---|
| spot·`book_apply` | 1.400 | **0.996** | −29 % |
| spot·`book_pipeline_total` | 1.804 | **1.310** | −27 % |
| usdm·`book_apply` | 3.185 | **2.347** | −26 % |
| usdm·`book_pipeline_total` | 3.602 | **2.770** | −23 % |

### La salvedad que no se puede ocultar

El mercado estaba más flojo: trades −72 %/−75 %, filas escritas −44 %. **Pero**
`depth_diff_messages` —el caudal que gobierna las métricas que mejoraron— fue
**idéntico** (599.9→599.2 y 588.2→587.9, al 0.1 %). Indicio fuerte, no prueba.
La prueba concluyente sería la de Gemini: dos procesos en paralelo, mismo flujo,
misma hora, 48 h. **Requiere orden del operador.**

Parche conservado en `parches/uvloop_gcfreeze_dual_main.patch` con huellas
antes/después. **No promovido a la instalación base.**

---

## 2. Bloqueador de disco — resuelto esta noche

Medido: **3.74 GiB/h**. Siete días = **628 GiB**; libres = **120 GiB**. La
captura moría a las ~32 h. Ver `planes/BLOQUEADOR_DISCO_7DIAS.md`.

**Orden del operador:** *"COMPRIME LA CARPETA Y ELIMINA EL ARCHIVO […] LUEGO DE
GENERARLO"*.

### Lo que se hizo, en orden

1. Gemini escribió `/home/trading/jean-flow-exec/herramientas/convertir_parquet.py`
   bajo contrato con cinco salvaguardas (S1 captura activa, S2 ruta bajo
   staging_runs, S3 verificar en la ejecución en curso, S4 solo `.csv` bajo
   `capture/`, S5 espacio libre).
2. **Revisión del revisor:** estructura del borrado leída línea a línea. Solo
   dentro del `else` de la verificación, solo con `--borrar`, y con comprobación
   de ruta.
3. **Prueba en seco:** 52× y 70×, CSV conservados.
4. **Verificación independiente:** el revisor releyó los parquet con el módulo
   `csv` de Python —otro motor— y comparó **288 000 celdas**: cero
   discrepancias, columnas y filas idénticas.
5. **Fallo encontrado:** el salto por idempotencia se llevaba por delante el
   paso de borrar, así que un fichero convertido en seco no podía borrarse
   nunca después. Corregido por Gemini: reverifica en la ejecución en curso
   antes de borrar.
6. **Vuelta atrás probada** antes de tocar nada gordo (ver punto 3).
7. Conversión lanzada **en segundo plano** sobre las 11 capturas.

**Resultado parcial (21:47 UTC):** 29 ficheros, **10 GB liberados**, 0 fallos,
factores de 49× a 75×.

---

## 3. Descubrimientos del método

### 3.1 El auditor NO lee Parquet

`grep -c parquet audit.py` = **0**. `reconstruct.py` idem: solo `*.csv`. Borrar
los CSV significa que esas capturas solo se re-auditan si la vuelta atrás
funciona.

**Probado:** parquet → CSV → auditor. Devolvió **rc=0**, `causal_replay: PASS`,
`journal_integrity: PASS`. Las diferencias con el original son de formato
(comillas de cabecera y fin de línea; ~74 KB de 29.8 MB), no de dato. Se escribió
`puente_github/scripts/reconstruir_csv.py` para que la vuelta sea byte a byte.

**Borrar es reversible.**

### 3.2 `parquet_store.py` ya existía — error del revisor

641 líneas del autor original, con validación fila a fila (`_validate_row`),
huella lógica por fila (`_logical_digest_row`), bloqueo exclusivo entre procesos,
detección de bloqueo huérfano, y —lo importante para el gate de 7 días—
`discover_closed_csv` y `SegmentBusy`, que distinguen el fichero ya cerrado del
que el colector tiene abierto.

**Nadie lo importa.** Y el revisor lo había visto por la mañana y lo había
anotado, y aun así encargó uno nuevo. Detalle en
`planes/PARQUET_STORE_YA_EXISTIA.md`.

Regla que faltaba: **antes de encargar, buscar si ya está hecho.** Un `grep` del
concepto. Treinta segundos.

### 3.3 El puente serializa las órdenes

`watcher.py` procesa las órdenes en un bucle, una detrás de otra. Un script que
espera 540 s bloquea la cola entera. Pasó: cuatro órdenes detenidas nueve
minutos. Regla: **ninguna orden debe esperar**; lanzar en segundo plano y
consultar con órdenes cortas. Detalle en
`operaciones/LECCION_PUENTE_SERIAL.md`.

---

## 4. Investigación de latencia (`planes/INVESTIGACION_LATENCIA_V2.md`)

**Ya optimizado, no tocar:** `orjson` en el camino caliente (`json.loads`
aparece **0 veces** en `collector.py`), compresión del websocket desactivada,
troceo del escritor, `fsync` espaciado, umbrales del recolector,
`setswitchinterval`.

**Falta de verdad:** afinidad de CPU (`sched_setaffinity` **no aparece en ningún
sitio**), ajuste de `SO_RCVBUF` (no hay un solo `setsockopt`), auditorías en
paralelo (spot y usdm son independientes y hoy corren en fila: 17 min → ~11).

### El objetivo: los 19 ms de `event_loop_lag`

`audit.py` documenta que el umbral se subió de 20 a 40 ms **solo por Windows**
(cuanto del temporizador de 15.625 ms). Palabras del autor: *"El límite de 20 ms
era un criterio de grado servidor (Linux con timer de alta resolución)"*.
**Estamos en Linux: los 19 ms son un atasco real, no el reloj.**

**Hipótesis H1 (a confirmar o refutar):** `csv.writer.writerows()` es una función
en C que **no libera el GIL**. Mientras el hilo escritor está dentro, el bucle de
eventos no puede ejecutar nada. Y `setswitchinterval(0.001)` no ayuda porque solo
actúa **entre** instrucciones de bytecode, y `writerows` es una sola.

A favor: futuros escribe el doble de filas que spot y es donde más se sufre;
uvloop movió esta métrica un 4 % frente al 23-29 % de las demás (coherente:
uvloop acelera el bucle, pero no puede correr sin el GIL); y el propio código
tiene un contador `writer_gil_yields`.

Encargado a Gemini un **banco de pruebas** (`herramientas/banco_gil.py`) que
reproduce la arquitectura en pequeño y compara cuatro escenarios. Se le pidió
expresamente que **diga si refuta la hipótesis**.

---

## 5. Pendientes al cierre de este tramo

1. Terminar la conversión (queda el gate 3, 18 GB) y dar la cifra final.
2. Leer el veredicto del banco del GIL.
3. Probar `reconstruir_csv.py` y confirmar la vuelta byte a byte.
4. **Probar y enganchar `parquet_store.py`** para la rotación en vivo del gate
   de 7 días. No hay que escribirlo: hay que integrarlo.
5. Afinidad de CPU + `SO_RCVBUF` (con A/B obligatorio).
6. Auditorías spot/usdm en paralelo.
7. Bajar el tope de `ejecutar_script_repo` de 600 s a ~120 s.
8. Decisión del operador: ¿A/B en paralelo de 48 h para zanjar lo de uvloop?
9. Sigue pendiente de antes: sincronizar con Notion, respaldo v2 y descarga,
   recortar permisos del PAT.
