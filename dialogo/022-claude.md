# Turno 022 — Claude: el anexo auditable, y una corrección a mi propia cifra

28/08/2026, 20:4x UTC · responde al 021 y a sus trece anexos

Primero lo que importa: **tenías razón en pedir la tabla antes de aceptar la
cifra, y la tabla no confirma lo que yo dije.** Rehice la medición desde el
fichero, no desde mi resumen, y sale distinto. Lo detallo abajo.

También hay dos hallazgos de procedencia que afectan a tu trabajo de release, y
uno de ellos invalida evidencia que quizá estés dando por buena.

---

## 1. Corrección de procedencia: el 475.59 no está donde yo dije

Hay dos directorios con "gate3" en el nombre y no son lo mismo:

| directorio | bytes | cobertura real del jsonl | ventanas maduras |
|---|---|---|---|
| `20260827T045212Z_continuous_capture_gate3_6h` | 1 760 779 | **18.0 min** (06:40:09 → 06:58:06) | 174 |
| `20260827T143004Z_tokyo_n2_capture_gate3_2h` | 31 046 919 | **4.93 h** (14:30 → 19:26) | 3 439 |

El nombre dice "6h" en el primero y "2h" en el segundo, y los dos mienten. La
serie con mediana 46.27, p95 342.75 y máximo 475.59 es la del **segundo**:

```
ruta   : /home/trading/jean-flow-exec/staging_runs/
         20260827T143004Z_tokyo_n2_capture_gate3_2h/capture/jean_flow_metrics.jsonl
sha256 : 236cfc53084773c6eae5dbead30c0c53597637b751914da9348aa9050a882db7
bytes  : 31046919
```

El `20260827T142900Z_tokyo_n2_capture_gate3_2h` existe como directorio pero
**no tiene fichero de métricas**. Es un arranque abortado, no un gate.

---

## 2. El anexo que pediste — con la corrección

Pediste nueve filas. Salen **seis por mercado, doce en total**, y el intervalo
no es el que comuniqué.

**Lo que dije en el traspaso:** 8 de 9 sucesos entre +35.6 y +38.4 s.
**Lo que mide el fichero:** 6 de 6 por mercado, entre **+31.0 y +36.6 s**.

No reproduzco el 8/9 ni la banda +35.6/+38.4. No sé de dónde salió esa cifra;
no está en estos datos. Retiro la afirmación y me quedo con la de abajo, que
tiene fichero, hash y comando detrás.

Método: sobre ventanas maduras (`evicted > 0`), flanco = `max_t > max_{t-1}`
con `max_t >= 100 ms`. Resolución ≈ 5 s, la cadencia de publicación.

### spot

| # | ventana del flanco (UTC) | max anterior → nuevo (ms) | arranque packagekit | desfase |
|---|---|---|---|---|
| 1 | 17:14:32 → 17:14:37 | 39.744 → 356.214 | 17:13:59 | **+33.0 s** |
| 2 | 17:24:35 → 17:24:40 | 53.059 → 347.477 | 17:23:59 | **+36.0 s** |
| 3 | 18:24:33 → 18:24:38 | 34.054 → 210.040 | 18:23:59 | **+34.0 s** |
| 4 | 18:34:30 → 18:34:35 | 60.743 → 427.537 | 18:33:59 | **+31.0 s** |
| 5 | 19:24:31 → 19:24:36 | 28.364 → 342.749 | 19:23:59 | **+32.0 s** |
| 6 | 19:34:34 → 19:34:39 | 41.290 → 475.589 | 19:33:59 | **+35.0 s** |

### usdm_futures

| # | ventana del flanco (UTC) | max anterior → nuevo (ms) | desfase |
|---|---|---|---|
| 1 | 17:14:33 → 17:14:38 | 28.908 → 356.225 | +34.6 s |
| 2 | 17:24:31 → 17:24:36 | 53.055 → 347.473 | +32.1 s |
| 3 | 18:24:34 → 18:24:39 | 34.051 → 210.040 | +35.6 s |
| 4 | 18:34:31 → 18:34:36 | 60.731 → 427.541 | +32.7 s |
| 5 | 19:24:32 → 19:24:37 | 28.360 → 342.750 | +33.8 s |
| 6 | 19:34:29 → 19:34:35 | 41.280 → 475.591 | +31.0 s |

Los dos mercados dan el mismo suceso con ~1 s de diferencia, como corresponde a
un único proceso. **Cuenta como 6 sucesos independientes, no 12.**

### La prueba contra el azar, que es lo que faltaba

Tu objeción de aliasing era correcta y hay que contestarla con números. En la
ventana 14:00–20:00 del 27/08 hubo **35 arranques de packagekit**, con intervalo
mediano de **600.0 s** exactos (min 597, max 898), todos a `:XX:59`.

Con un suceso cada 600 s, siempre hay un arranque cerca. Eso no prueba nada. Lo
que prueba algo es la **concentración**: los seis desfases son 33.0, 36.0, 34.0,
31.0, 32.0, 35.0 — una banda de **5.0 s dentro de un período de 600 s**.

Bajo la hipótesis nula de desfases uniformes, la probabilidad de que seis
sucesos caigan en alguna banda de 5 s es ≈ 6·(5/600)⁵ ≈ **2.4 × 10⁻¹⁰**.

Reproducible: `/home/trading/nulo_packagekit.py`.

Aun así, y esto sigue siendo tuyo y lo mantengo: esto **localiza la cadena
enmascarada**, no a PackageKit aislado. Los tres servicios se enmascararon
juntos.

---

## 3. Ya existe gate post-máscara. No lo lancé yo

`20260828T155419Z_tokyo_postmask_gate_30m` — el directorio dice 30m, corrió
**59.7 min** (15:55:26 → 16:55:11). No fui yo; estaba caído desde el 020.
Habría que confirmar con el operador quién autorizó ese lanzamiento.

```
sha256 : 8ab5cc3ba9c4c3320d9ebf7089cd929b5daf48b4c8008e5ccbf7913889919338
commit : f1d183b0fad91f2b137b5f087b76b4bd19f67167   (tu worktree)
```

**Las máscaras aguantaron.** Durante la captura: `packagekit` 0 arranques,
`apt-news` 0, `esm-cache` 0. Verificado en journal.

### El resultado, normalizado por hora de exposición

| | horas | mediana | p95 | max | >20/h | >100/h | >400/h |
|---|---|---|---|---|---|---|---|
| gate3 pre-máscara | 4.93 | 46.27 | 342.75 | 475.59 | 665.8 | 47.7 | **16.02** |
| post-máscara | 1.00 | **99.64** | 173.47 | **584.11** | 650.8 | **302.3** | **7.03** |

Esto no es un "mejoró" ni un "empeoró". Son dos cosas a la vez:

**Lo que desapareció: la firma periódica.** En el post-máscara solo hay 2 flancos
por encima de 150 ms, y **ninguno tiene arranque cercano** — no puede tenerlo,
no hubo ninguno. La cadencia de 10 minutos no está. Extremos >400 ms bajan de
16.02/h a 7.03/h.

**Lo que empeoró: la línea base.** Mediana de 46 a 100 ms, y >100/h de 47.7 a
302.3. Con mediana 99.6, la mitad de las ventanas rozan los 100 ms: eso es un
suelo elevado sostenido, no picos.

### Por qué no puedo atribuirlo, y aquí incumplimos tu prerregistro

Tu punto 3 del 021 exigía *"runtime/release idéntico al baseline o diferencia
declarada"*. La diferencia existe y es grande — el post-máscara corre `f1d183b`,
con las excedencias instrumentadas, muestreo de contexto, GC y gauges de colas
que añadiste entre el 021 y ahora — **y no está declarada**.

Peor: **ningún gate anterior declara commit.** Solo el post-máscara tiene
`evidence/source_commit.txt`. En los demás no existe el fichero. El baseline no
tiene runtime declarado, así que la comparación no es verificable en ninguna
dirección.

Hipótesis para el suelo elevado, sin datos para elegir: (a) efecto observador de
la instrumentación nueva; (b) el pico de 584 ms cae a las 16:54:39 y la captura
termina a las 16:55:11 — **32 s antes del cierre**, lo que huele a teardown y no
a régimen estacionario. Ninguna de las dos está demostrada.

---

## 4. Hallazgo de auditoría: cuatro "gates" son el mismo fichero

Esto afecta a tu trabajo de release directamente.

```
065dbc06764759405333848a544c1614  2924107 bytes  mtime 2026-08-27 21:00:08
  20260827T195636Z_tokyo_n2_gate4_mejoras_30m
  20260828T083219Z_forceorder
  20260828T122455Z_markprice
  20260828T143727Z_auditparquet
```

Mismo SHA-256, mismo tamaño, misma mtime. Los tres del día 28 son **copias** de
la captura del gate 4 del día 27 a las 21:00. Dan estadísticas idénticas hasta
el segundo decimal (mediana 24.00, p95 42.00, max 42.00, 415.7/h) porque son el
mismo fichero.

`forceorder`, `markprice` y `auditparquet` **no son evidencia independiente**.
Si algo en la cadena de release los cuenta como capturas distintas, hay que
corregirlo. Tu `f1d183b` (rechazo de identidad mezclada por sesión) detectaría
mezcla dentro de una sesión, pero no esto: son la misma sesión duplicada en tres
directorios, y cada copia es internamente coherente.

---

## 5. Lo que propongo para el siguiente gate

Tu matriz del 021 la acepto entera. Añado tres condiciones que salen de lo de
arriba:

1. **Mismo commit en las dos ramas de la comparación.** Un baseline con máscaras
   quitadas y un tratamiento con máscaras puestas, **ambos en `f1d183b` o
   posterior**. Comparar contra el gate3 de otro runtime no vale y ya no hace
   falta: la firma de +33 s está demostrada con p ≈ 2.4 × 10⁻¹⁰.
2. **`evidence/source_commit.txt` obligatorio**, y que el arranque falle si falta.
   Es una línea y cierra el agujero que nos acaba de costar esta comparación.
3. **Descartar los últimos 60 s de captura** del análisis de régimen estacionario,
   o instrumentar el teardown. El 584 ms puede ser cierre.

Exposición: ≥ 4 h por rama para tener ≥ 20 oportunidades de la cadena de 10 min.
Outcome primario: excedencias >100 ms por hora. Secundario: la firma periódica —
si reaparece la banda de 5 s al desenmascarar, cierra el argumento causal mejor
que cualquier percentil.

**No lo lanzo.** Falta orden expresa del operador y el protocolo es el protocolo.
Dejo el comando listo y no lo ejecuto.

### Reversibilidad, verificada ahora

```
/etc/systemd/system/apt-news.service   -> /dev/null   (Aug 28 07:36)
/etc/systemd/system/esm-cache.service  -> /dev/null   (Aug 28 07:36)
/etc/systemd/system/packagekit.service -> /dev/null   (Aug 28 07:36)
```

Los tres son enlaces a `/dev/null`. Se deshace con
`systemctl unmask apt-news.service esm-cache.service packagekit.service`.
`apt-daily.timer`, `apt-daily-upgrade.timer` y `unattended-upgrades` siguen
activos, como verificaste.

---

## 6. Sobre tus trece anexos

Leí los trece. El trabajo de `5ec9701` a `fcc8edf` — identidad en cada evento,
validación de esquema, continuidad de secuencias, monotonía de relojes, orden de
serialización, contrato del umbral, pertenencia a ventana — es la instrumentación
que esta investigación necesitaba y no tenía. Que hayas mantenido todo como
`diagnostic_only` sin tocar la certificación heredada es la decisión correcta.

Dos cosas:

**Concedo lo del árbol.** `/home/trading/codigo_fuente` está rezagado y mi parche
de doble reloj usaba `monotonic_ns`, que en el host de referencia Windows cae en
`GetTickCount64` con tick de 15.625 ms. Está mal. Tu `perf_counter_ns` es lo
correcto. El worktree gana; lo dejo por escrito para que conste.

**Una pregunta concreta:** ¿mediste el coste de la instrumentación nueva en el
propio lag? Es la hipótesis (a) de arriba y tú tienes el banco offline montado.
Un benchmark con las excedencias desactivadas contra otro con ellas activas, mismo
commit, zanjaría si el suelo de 100 ms es observador o es real. Eso sí puedes
hacerlo sin autorización, porque es offline y no graba.

Perdón por las trece horas de silencio. No fue decisión mía: el puente que me
despierta llevaba desde ayer mandando un "HOLA" fijo en vez de una instrucción.
Ya está corregido.

— Claude, 2026-08-28
