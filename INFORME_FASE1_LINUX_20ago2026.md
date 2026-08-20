# INFORME — Ejecución de la Fase 1 de la transición a Linux

**Fecha:** 20 de agosto de 2026.
**Plan rector:** `INFORME_TRANSICION_LINUX_v2_15ago2026.md` (incorporado a este repositorio junto a este informe).
**Alcance:** este informe **ejecuta la Fase 1** del plan (fidelidad por replay idéntico) y prepara los materiales
de las fases siguientes. **No se ha modificado ni una línea del motor, ni un umbral, ni un certificado, ni el
paquete sellado.** Todo lo nuevo vive en `transicion_linux/` y en este informe.

---

## 0. Cómo leer este informe

Misma disciplina del plan rector:

| Etiqueta | Qué significa |
|---|---|
| **[HECHO COMPROBADO]** | Se abrió el archivo y se leyó, o se ejecutó la medición. Lleva archivo y línea, o el número medido. Se puede volver a comprobar. |
| **[ESTIMACIÓN]** | Número derivado de datos reales mediante un cálculo declarado. |
| **[HIPÓTESIS]** | Explicación plausible no demostrada. Se marca para poder refutarla. |
| **[DECISIÓN DEL PROYECTO]** | Elección de Jean o regla del protocolo. No se discute técnicamente: se cumple. |

---

## 1. Qué se pidió y qué se hizo

Se pidió analizar todos los archivos entregados y **preparar la transición a Linux**. Los archivos analizados:

1. `INFORME_TRANSICION_LINUX_v2_15ago2026.md` — el plan rector, con sus fases 0 a 4 y sus decisiones.
2. `Plan_Maestro_JEAN_FLOW_555_Meta_Quant (PDF, Gemini Spark)` — 3 páginas: diagnóstico de Windows, alternativas y hoja de ruta de fases 1–4.
3. `play book maestro quant (HTML, Gemini Ultra)` — metodología de las fases 1–3 del proyecto.
4. `IDEAS.zip` — plantillas de skills y protocolos (IDEA 2, 3 y 4), **y un árbol completo del proyecto en su
   versión 2.3.4 con la corrida real de campo `20260814T081136_503806Z_10m_d64fea5560ac` (452 MB de journals de
   spot y futuros, con sus auditorías generadas en Windows)**. Ese árbol resultó ser la pieza clave: contiene la
   referencia de Windows contra la que se pudo medir la fidelidad.
5. El repositorio, con el **paquete sellado vigente v2.4.1** en `entregables/` (sellos verificados: los 11
   archivos de `SELLOS.sha256` dan OK).

**Sobre el conflicto entre planes, y hay que decirlo antes de seguir:** el PDF de Gemini recomienda WSL2 o
Docker como vía inmediata y una reescritura del núcleo en Rust. **[DECISIÓN DEL PROYECTO]** El plan rector ya
rechazó las tres cosas: ni WSL2 ni Docker como solución definitiva (la evidencia diría «Linux» con sustrato
Windows), ni reescritura en Rust o Go salvo necesidad demostrada por mediciones
(`INFORME_TRANSICION_LINUX_v2_15ago2026.md`, secciones 1 y 10). Este trabajo sigue las decisiones del proyecto:
**Linux nativo, manteniendo Python, con chronyd y systemd.** Las ideas del PDF que sí son compatibles (chrony,
cero UAC, fin del cuanto de 15,625 ms) quedan absorbidas por esa vía.

**Lo ejecutado:** la Fase 1 completa del plan rector, que por diseño «no toca la máquina de Jean y no necesita
nada de él» (sección 7 del plan). Se ejecutó en un contenedor Linux con el árbol sellado v2.4.1 extraído del
propio repositorio.

---

## 2. Entorno donde se ejecutó la Fase 1

**[HECHO COMPROBADO]** Linux 6.18.5, x86_64, Intel Xeon 2,80 GHz, 4 núcleos, 15 GiB de RAM. Python 3.12.3
(mismo minor 3.12 que el 3.12.10 de la laptop de Jean; las ruedas son cp312 en ambos). Reloj monotónico:
`clock_gettime(CLOCK_MONOTONIC)` con **resolución de 1 nanosegundo** — el cuanto de ~15,6 ms del reloj
monotónico de Windows no existe en esta plataforma (`transicion_linux/evidencia/entorno_linux.txt`).

**[HECHO COMPROBADO]** El tráfico NTP (UDP 123) está bloqueado en este contenedor: sondas SNTP a
`time.google.com`, `pool.ntp.org` y `time.cloudflare.com` agotaron el tiempo de espera. Coincide con lo que el
plan rector midió en su entorno (sección 9). **No dice nada sobre la red de Jean**; medirla sigue pendiente para
la fase 2.

---

## 3. Resultados de la Fase 1 — los cuatro criterios, fijados antes de ejecutar

Los criterios son los de la tabla de la Fase 1 del plan rector. Ninguno se ajustó después de ver los números.

### 3.1 Integridad del árbol en Linux — **APROBADO**

**[HECHO COMPROBADO]** `sha256sum -c` sobre `RELEASE_MANIFEST.sha256` del paquete sellado v2.4.1 extraído en
Linux: **144 de 144 sellos OK**, cero fallos. El mismo manifiesto, los mismos sellos, la misma herramienta de
verificación estándar.

### 3.2 Replay causal idéntico entre plataformas — **APROBADO**

La prueba central. Se tomaron los journals reales de la corrida de campo `d64fea5560ac` (capturados en la
laptop de Jean el 14 de agosto de 2026: 418 095 filas de spot y 799 714 de futuros) y se ejecutó
`binance_collector.audit journal` del motor **v2.4.1** en Linux, **dos veces por mercado**, igual que hace el
launcher. Después se comparó contra los informes `audit_spot.json` y `audit_usdm_futures.json` que Windows
generó en campo.

| Comparación | spot | futuros USDⓈ-M |
|---|---|---|
| Sello canónico del replay en Windows | `e9d8a230…cfa6f4af` | `beff8f18…589bda2d` |
| Sello canónico del replay en Linux | `e9d8a230…cfa6f4af` | `beff8f18…589bda2d` |
| ¿Idénticos? | **SÍ, byte a byte** | **SÍ, byte a byte** |
| Dict `replay` completo (niveles, contadores, generation, last_update_id) | **idéntico** | **idéntico** |
| `journal_integrity` / `causal_replay` | PASS / PASS en ambas plataformas | PASS / PASS en ambas plataformas |
| Linux corrida 1 vs corrida 2 (determinismo) | informes **byte a byte idénticos** | informes **byte a byte idénticos** |

**[HECHO COMPROBADO]** El diff campo a campo del informe completo de auditoría entre plataformas arroja **una
única diferencia: el campo `files`**, que contiene la ruta absoluta de los journals en cada máquina
(`C:\JF\555\…` frente a la ruta del contenedor). Todo lo demás — eventos, estados del libro, identidad causal,
latencias derivadas de cabeceras del journal, disposiciones de deltas — es idéntico
(`transicion_linux/evidencia/replay_comparacion.json`).

**Matiz que hay que declarar y no esconder:** el criterio del plan pide informes «idénticos byte a byte». Los
informes de Windows disponibles los escribió el motor **2.3.4 en cp1252** (el defecto de codificación corregido
en la 2.3.5), así que la identidad byte a byte del *archivo* completo es imposible por construcción contra esa
referencia; además **[HECHO COMPROBADO]** `audit.py:448` incrusta rutas absolutas con `str(path)`, de modo que
dos informes de máquinas distintas jamás serán byte-idénticos aunque todo lo demás coincida. Lo que el launcher
compara realmente entre sus dos replays (`launcher.py:1414-1459`) es el dict `replay` completo y su `sha256`
canónico — y **eso es idéntico entre plataformas**, además de byte-idéntico entre las dos corridas de Linux.
**[HECHO COMPROBADO]** El sello canónico se calcula sobre un documento JSON sin floats, con claves ordenadas,
niveles ordenados por precio entero y UTF-8 en memoria (`reconstruct.py:57-75`): es independiente de plataforma
por construcción, y la medición lo confirma.

### 3.3 Batería de pruebas offline en Linux — **APROBADO**

**[HECHO COMPROBADO]** Árbol v2.4.1 en Linux: **263 superadas, 2 omitidas, 0 fallos** (7,47 s). Referencia de
Windows: 263 superadas, 2 omitidas (`INFORME_RELEASE_v2.4.1_15ago2026.md`). **Mismo recuento, cero omisiones
nuevas.**

**[HECHO COMPROBADO]** Las 2 omitidas son las mismas en ambas plataformas y no tienen que ver con el sistema
operativo: son las pruebas de red real gateadas por `RUN_BINANCE_LIVE=1` (`tests/test_live_smoke.py:44`).

**[HECHO COMPROBADO]** Verificación adicional con el árbol histórico 2.3.4 del IDEAS.zip: **221 superadas,
2 omitidas** en Linux; su `pytest_offline.txt` de campo en Windows registra exactamente 221 y 2.

**[HECHO COMPROBADO]** En los 28 archivos de pruebas no existe ni un solo `skipif` de plataforma ni una
invocación real de PowerShell: todo lo «Windows» se valida por análisis estático de texto o con dobles de
Python puro, por eso la batería es idéntica en ambos sistemas. La única pieza condenada a cambiar en la Fase 3
es `test_windows_time_assets.py` (31 pruebas que validan los activos `.ps1` que Linux sustituye).

### 3.4 Almacén de ruedas reconstruido para Linux — **APROBADO**

**[HECHO COMPROBADO]** `transicion_linux/wheelhouse_linux/` contiene las **20 ruedas en las versiones exactas**
de `requirements.lock`: las 13 puras copiadas del propio wheelhouse sellado (sus sellos coinciden byte a byte
con los del lock), y las 7 binarias (`aiohttp`, `frozenlist`, `multidict`, `orjson`, `propcache`, `websockets`,
`yarl`) como **manylinux cp312 compiladas** — se rechazó expresamente la variante pura de `frozenlist` y
`websockets` para conservar la paridad de rendimiento de la ruta caliente.

**[HECHO COMPROBADO]** Las 20 ruedas se verificaron contra una segunda fuente (la API JSON de PyPI): **20 de
20 OK, 0 discrepancias**. Manifiesto sellado en `WHEELHOUSE_LINUX_MANIFEST.sha256` y lock propio en
`requirements_linux.lock`.

**[HECHO COMPROBADO]** La instalación **offline** desde ese almacén con `pip --no-index --require-hashes` en un
venv de Python 3.12 terminó limpia y todos los imports binarios funcionan. Es la misma disciplina del
instalador de Windows.

**[HECHO COMPROBADO]** `supply_chain.py` no asume `win_amd64`: ignora el platform tag del nombre y exige la
cadena lock == manifiesto == SHA-256 real del wheel (`supply_chain.py:73-79`, `:155-174`). Su biyección «una
rueda por (nombre, versión)» implica que cada plataforma necesita su par lock+wheelhouse — exactamente lo que
se construyó.

### Veredicto de la Fase 1

> **FASE 1: APROBADA. Los cuatro criterios se cumplen sin ajustar ninguno. Cero bloqueos abiertos.**

**Límites de lo demostrado, dichos sin adornos:** esta fase demuestra que el motor **audita, replays y prueba
igual** en Linux. **No** demuestra rendimiento de captura en vivo, ni comportamiento de la red de Jean, ni
conducta de chronyd durante horas: eso es exactamente la Fase 2, que requiere hardware real y la decisión de
Jean sobre dónde correr Linux. Además, el launcher de arranque **hoy se niega a correr en Linux por diseño**
(**[HECHO COMPROBADO]** gate `WINDOWS_REQUIRED` en `launcher.py:2553-2556` y `jean_flow_launcher.py:529-532`);
esta fase lo rodeó legítimamente invocando el auditor por su CLI, que es lo que la Fase 1 debía medir. Quitar
ese gate es trabajo de la Fase 3, no un defecto.

---

## 4. Hallazgo adicional: la sesión fallida de agosto, explicada de punta a punta

El árbol 2.3.4 del IDEAS.zip trajo la sesión `d64fea5560ac` completa, con su `RESULT.json`. Con eso se pudo
cerrar lo que el plan rector dejó marcado como no probado (su sección 3):

1. **[HECHO COMPROBADO]** `RESULT.json`: `status = DATA_GATES_FAILED`, `pass = false`, `engine_exit_code = 0`,
   `capture_commitment = True`. El motor capturó bien y comprometió su evidencia.
2. **[HECHO COMPROBADO]** El reloj **pasó** (17,478 ms, `error_code: "PASS"`). El fallo no fue del reloj.
3. **[HECHO COMPROBADO]** `audit_metrics.json` de esa sesión no contiene un informe: contiene el rastro de
   `UnicodeEncodeError` de cp1252 en `audit.py:1180`, al imprimir la θ de la propia nota del reloj.
4. **[HECHO COMPROBADO]** La cascada es más profunda de lo que el plan rector sabía: los informes de replay de
   esa sesión **existen, están completos y dicen PASS por dentro**, pero están escritos en cp1252, y el lector
   del launcher exige UTF-8 estricto (`runtime.py:60`). Intentar leerlos como UTF-8 falla en el byte 0xE9
   (medido). Por eso `RESULT.json` marca `spot`, `usdm_futures`, `identity` y `metrics` en False: **el auditor
   no pudo releer sus propios informes.** Todo era codificación. Corregido desde la 2.3.5.
5. **[HECHO COMPROBADO]** Re-auditada la sesión entera en Linux con el motor 2.4.1: `identity` da **PASS**
   (0 conflictos, completitud 38 612/38 612 = 1,0) y los replays de ambos mercados dan **PASS** con los sellos
   idénticos a los de campo. La captura de aquella noche era causal e íntegramente **sana**.
6. **[HECHO COMPROBADO]** El único gate que esa sesión falla de verdad con el motor vigente es el de métricas
   de rendimiento: `book_apply` y `book_pipeline` con «worst p99 post-warmup» de **15–16 ms exactos contra el
   límite de 5 ms** — el valor del cuanto de 15,625 ms del temporizador de Windows que el motor 2.3.4 aún no
   esquivaba (corregido en 2.4.0 con el opt-out de EcoQoS y el temporizador fino; `event_loop_lag` 23 ms ≤ 40,
   `parse` y `writer_yield` en verde). **[ESTIMACIÓN]** En Linux esa clase de fallo desaparece
   estructuralmente: no hay cuanto de 15,6 ms que contaminar las mediciones.

**Ojo:** esto explica la sesión **de agosto**. La petición de la Fase 0 del plan rector — el zip de evidencia
de «la última sesión que realmente falló, la reciente» — **sigue en pie y solo Jean puede ejecutarla.**

---

## 5. Evidencia orientativa de rendimiento (NO es la Fase 2 y no la sustituye)

**[HECHO COMPROBADO]** El benchmark del propio árbol (`benchmarks/benchmark_latency.py`, motor 2.4.1) ejecutado
en este contenedor Linux aprueba los 5 checks. Comparado con el registro de campo de Windows
(`benchmark_latency.json` del preflight del 14 de agosto, motor 2.3.4, laptop de Jean):

| Métrica | Windows (campo, laptop) | Linux (contenedor) |
|---|---|---|
| `event_loop_lag` durante snapshot de 10 001 filas: p50 / p99 / máx | 8 / 16 / 16 ms — el cuanto a la vista | 0,66 / 1,77 / 4,74 ms |
| `book_core` p99 | 0,0038 ms | 0,027 ms |
| `book_pipeline_total` p99 | 0,136 ms | 0,302 ms |

**[ESTIMACIÓN]** La lectura honesta: en Linux desaparece la cuantización de 15,6 ms que domina el `event_loop_lag`
de Windows; los números absolutos de las demás métricas **no son comparables** entre estas dos máquinas (CPU
distinta, motor distinto en la referencia). La comparación limpia es la Fase 2, en el hardware que Jean decida.

---

## 6. Mapa de adaptación para la Fase 3 (del análisis exhaustivo del árbol v2.4.1)

Ocho agentes de análisis en paralelo recorrieron el árbol sellado completo, con verificación adversarial de citas incluida. El acoplamiento a Windows está **concentrado y
acotado**; la abrumadora mayoría del motor es portable tal cual (la Fase 1 lo demuestra empíricamente).

**Lo que bloquea el arranque (2 sitios):**
- **[HECHO COMPROBADO]** `jean_flow_launcher.py:529-532` y `launcher.py:2553-2556`: gates `WINDOWS_REQUIRED`.
  En la Fase 3 se invierten a exigir Linux + chronyd.

**Lo que se reescribe (el subsistema de reloj, ya diseñado):**
- **[HECHO COMPROBADO]** Tres puntos de invocación de `Test-ClockSync.ps1` (`launcher.py:1137`, `:1221`,
  `:1271`), el ejecutor PowerShell (`:809-818`), el `/resync` elevado por UAC vía `ShellExecuteExW`
  (`:651-739`), los validadores de evidencia W32Time/Meinberg (`:842-1119`) y el decodificador
  cp1252/UTF-16 (`:525-536`). Todo eso lo sustituye la lectura de `chronyc -c tracking` (CSV estable,
  independiente del idioma) — borrador funcional en `transicion_linux/borradores_fase3/lector_chrony.py`.
  `CLOCK_WARN_MS = 50.0` (`launcher.py:47`) y `READY_CLOCK_FUTURE_TOLERANCE_S = 5.0` (`launcher.py:51`)
  **se conservan con sus números intactos**.

**Lo que ya tiene rama POSIX escrita y funcional (solo se poda la rama NT en Fase 3):**
- **[HECHO COMPROBADO]** Instancia única con `fcntl.flock` (`launcher.py:2297`, `jean_flow_launcher.py:80`),
  `_pid_alive` (`dual_main.py:215-233`), grupos de proceso con `start_new_session` (`launcher.py:1791-1794`),
  señales con `add_signal_handler` (`dual_main.py:283-295` — en Linux el camino primario funciona y SIGTERM
  pasa a ser la vía real de parada bajo systemd).

**Lo que en Linux se vuelve innecesario (el origen del dolor):**
- **[HECHO COMPROBADO]** `latency.py` concentra todo el código Windows real: `timeBeginPeriod(1)` vía winmm y
  el opt-out de EcoQoS vía `SetProcessInformation` (`latency.py:45-165`). En Linux no existen ni el cuanto de
  15,6 ms ni EcoQoS; el equivalente es la unidad systemd (prioridades explícitas). `fine_timer_resolution`
  se reescribe manteniendo su contrato de context manager para que el log de sesión no registre falsos
  negativos (`main.py:119`, `dual_main.py:747-758`).

**Ajustes con matiz, detectados por el análisis:**
- **[HECHO COMPROBADO]** `_windows_process_is_elevated` devuelve siempre False fuera de Windows
  (`launcher.py:554-558`): en Linux la protección anti-privilegios quedaría **muda en silencio**. En Fase 3 se
  sustituye por `os.geteuid() == 0` para conservar el rechazo de ejecución como root (la regla «cero consolas
  elevadas» del protocolo).
- **[HECHO COMPROBADO]** `reconstruct.py:480` ordena segmentos con `sorted(Path)`: case-insensitive en Windows,
  case-sensitive en Linux. Con los nombres homogéneos en minúsculas que emite `writer.py:224-225` el orden
  coincide, y ante cualquier segmento fuera de orden el replay falla cerrado con `ReplayError` (exigencia de
  contigüidad de secuencia), nunca datos corruptos en silencio. La Fase 1 lo confirma empíricamente: mismo
  orden, mismos sellos.
- **[HECHO COMPROBADO]** `writer.py` abre los CSV con `encoding="utf-8", newline=""` y el dialecto csv `excel`
  emite `\r\n` en **todas** las plataformas: los journals de Linux serán byte-compatibles con los de Windows.
  El fsync de directorio (`writer.py:386`) se **activa** en Linux (en Windows era un no-op): la durabilidad
  mejora, no empeora.
- **[HECHO COMPROBADO]** `audit.py:696` documenta que el límite de 40 ms de `event_loop_lag` es la revisión
  «relajada por el cuanto de Windows» de un criterio de 20 ms de grado Linux. **[DECISIÓN DEL PROYECTO —
  ya tomada en el plan rector]** El límite NO se relaja ni se toca ahora; si la Fase 2 sostiene endurecerlo,
  será un cambio explícito con versión nueva.
- **[HECHO COMPROBADO]** El estimador θ̂ contra Binance (`rest.py:217-268`) es puro `time.time_ns()` y
  aritmética entera: portable sin cambios, y su nota «evidencia, no gate» (`collector.py:343-344`) se conserva.

**Verificación adversarial del plan rector, porque la disciplina se aplica también hacia dentro:** las doce
afirmaciones [HECHO COMPROBADO] con cita del plan rector se releyeron contra el árbol v2.4.1 línea a línea.
**Diez CONFIRMADAS** (incluidas `CLOCK_WARN_MS` en `launcher.py:47`, la tolerancia de 5 s en `:51`, el
postflight que conserva evidencia en `:2632-2644`, los `clock_domains` en `audit.py:1187-1203` y la nota
«NUNCA usarse como gate sin banda» en `:1205-1211`). **Dos REFUTADAS y quedan corregidas aquí:**

1. El criterio de PASS del launcher **no** está en `launcher.py:1983-1987` (ahí hay un comentario del
   navegador): el criterio real — código de salida 0 del motor, validación del manifiesto de sesión Y
   auditoría — vive en `launcher.py:2021-2029` y `:2063-2067`. La consecuencia del plan rector (que el marcador
   causal nuevo debe incluir esos dos requisitos) **sigue siendo válida**; solo la cita era errónea.
2. El orden alfabético de segmentos está en `reconstruct.py:480` (la `:481` ordena los `.csv.partial`, cuya
   sola presencia aborta el replay), y la regla K1 (`reconstruct.py:294`) es de **unicidad** de `ingest_seq`,
   no de contigüidad; la contigüidad la exige otra validación del mismo replay. El comportamiento fail-closed
   que el plan rector afirmaba es correcto; las dos citas, no.

**Dos cifras del plan rector, ajustadas con el conteo real:** los «24 códigos de error» son exactos para la
cadena de gates de verificación y configuración (el directorio completo contiene 32, contando las herramientas
manuales de reparación); las «63 expresiones regulares» no se corroboran — el conteo real es de 39 sitios de
regex (45 incluyendo `-split`), concentrados en `TimeSync-Common.ps1` en ~10 familias multilingües con
tolerancia a mojibake. La conclusión del plan rector queda intacta: esa superficie desaparece entera con
`chronyc -c`, que emite CSV estable e independiente del idioma.

---

## 7. Qué queda preparado en esta rama

```
INFORME_TRANSICION_LINUX_v2_15ago2026.md      ← el plan rector, incorporado al repositorio
INFORME_FASE1_LINUX_20ago2026.md              ← este informe
transicion_linux/
  evidencia/                                  ← todo re-comprobable
    replay_comparacion.json                   ← sellos Linux vs Windows, ambos mercados
    audit_spot_linux_1.json                   ← informe de replay generado en Linux
    audit_usdm_futures_linux_1.json           ← ídem futuros
    audit_identity_linux.json                 ← identidad causal PASS en Linux
    audit_metrics_linux.json                  ← métricas de la sesión de agosto re-auditadas
    pytest_v241_linux.txt                     ← 263 passed, 2 skipped
    pytest_v234_linux.txt                     ← 221 passed, 2 skipped
    benchmark_latency_linux.json              ← benchmark orientativo
    entorno_linux.txt                         ← entorno exacto de ejecución
  wheelhouse_linux/                           ← 20 ruedas exactas + manifiesto + lock (4,7 MB)
  herramientas/
    construir_wheelhouse_linux.sh             ← reconstrucción reproducible con doble fuente
    comparar_replay_plataformas.py            ← la herramienta de la prueba de fidelidad
  borradores_fase3/                           ← NO ACTIVADOS; ver su LEEME.md
    iniciar.sh                                ← punto de entrada ÚNICO (sustituye a los 5 .cmd)
    instalar_linux.sh                         ← instalador en frío con sellos
    lector_chrony.py                          ← sustituto de las 2 202 líneas de PowerShell
    chrony.conf                               ← desliza siempre; escalón solo al arrancar
    jean-flow-555.service                     ← supervisión systemd
```

---

## 8. Cómo sigue la transición — pasos concretos y quién decide cada uno

1. **Fase 0 (pendiente, solo Jean):** ejecutar `RECOGER_EVIDENCIA_TODO.cmd` sobre la última sesión que
   realmente falló (la reciente, no la de agosto) y subir el zip. Instalar la v2.4.1 y correr una captura corta
   de línea base. Sin esto, cualquier discusión sobre el fallo reciente sigue siendo humo. **[ESTIMACIÓN]**
   Una tarde.
2. **Decisión de la Fase 2 (solo Jean, y conviene tomarla ya):** dónde corre Linux. Las tres opciones del plan
   rector siguen tal cual — misma laptop desde USB (comparación limpia, riesgo bajo pero real: tener a mano la
   clave de BitLocker **antes**), mini-PC dedicado (riesgo cero para su equipo, comparación sucia), o nube
   (sirve para estabilidad, no para medir su red). **[DECISIÓN DEL PROYECTO]** Nunca arranque dual en su única
   máquina.
3. **Fase 2 (tras la decisión):** capturas de 10, 30 y 120 minutos intercaladas Linux/Windows con los umbrales
   vigentes sin relajar ninguno, y medir si la red de Jean deja pasar NTP (el plan rector, sección 7, tiene la
   tabla de criterios ya fijada).
4. **Fase 3 (solo si 1 y 2 aprueban):** activar los borradores — un único punto de entrada, chronyd como
   fuente de reloj, systemd como supervisor, wheelhouse Linux sellado dentro del paquete, regenerar
   `RELEASE_MANIFEST.sha256` y adaptar las 31 pruebas de `test_windows_time_assets.py` a los activos nuevos.
   Con versión nueva y release sellado, como manda el protocolo.
5. **Fase 4:** las ocho condiciones del plan rector, sin cambios. La condición 1 (replay idéntico) y parte de
   la 2 y la 4 ya tienen evidencia a favor por esta Fase 1; se re-verifican sobre la instalación final.

---

## 9. Registro de bloqueos

**Ninguno abierto.** Ningún criterio de la Fase 1 falló; no hubo que clasificar nada. El formato del registro
(sección 8 del plan rector) queda vigente para las fases siguientes.

---

## 10. Lo que NO se hizo

- **No se tocó el motor**: ni una línea de `src/`, ni del launcher, ni de las pruebas.
- **No se tocó ningún umbral**: ni los 50 ms del reloj, ni los p99, ni el 40 ms del event loop.
- **No se tocó el paquete sellado** ni `SELLOS.sha256` ni ningún manifiesto existente.
- **No se tocó la evidencia histórica**: los runs de la sesión de agosto se leyeron, jamás se modificaron.
- **No se fabricó ningún PASS**: cada veredicto de este informe tiene su archivo de evidencia en
  `transicion_linux/evidencia/` y se puede recalcular.
- **No se declaró abierta la Fase 2** del plan cuantitativo ni se emitió certificado nuevo alguno:
  `RESULT.pass` y `CAPTURA_COMPLETA_AUDITADA.json` conservan exactamente su significado.
- **No se usó WSL2, ni Docker, ni Rust**: la vía es la decidida — Linux nativo con Python.

---

*Cada afirmación sobre código lleva archivo y línea del árbol sellado v2.4.1; cada número medido tiene su
archivo de evidencia en `transicion_linux/evidencia/`. Lo no demostrado quedó marcado como estimación o
hipótesis, y los límites de lo demostrado están declarados en el propio veredicto.*
