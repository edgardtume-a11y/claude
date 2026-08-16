# INFORME — Plan de transición y validación hacia Linux

**Versión 2, corregida.** Sustituye a `INFORME_ARBITRAJE_RELOJ_15ago2026.md`, que queda como evidencia histórica.
**Fecha:** 15 de agosto de 2026.
**Alcance:** documento de análisis y plan. **No se ha modificado ni una línea de código, ni un certificado, ni un
esquema, ni un instalador, ni ningún archivo del motor.**

---

## 0. Cómo leer este informe

Cada afirmación de este documento lleva una de estas cuatro etiquetas. Si una frase no la lleva, es texto de enlace y
no debe usarse para decidir nada.

| Etiqueta | Qué significa |
|---|---|
| **[HECHO COMPROBADO]** | Se abrió el archivo y se leyó, o se ejecutó la medición. Lleva archivo y línea, o el número medido. Se puede volver a comprobar. |
| **[ESTIMACIÓN]** | Número derivado de datos reales mediante un cálculo declarado. El cálculo se puede discutir; los datos de partida son hechos. |
| **[HIPÓTESIS]** | Explicación plausible que **no** está demostrada. Se marca para poder refutarla, no para apoyarse en ella. |
| **[DECISIÓN DEL PROYECTO]** | Elección de Jean o regla del protocolo. No se discute técnicamente: se cumple. |

Esta disciplina existe por una razón concreta. **[HECHO COMPROBADO]** En la entrega v2.4.1, nueve agentes en paralelo
produjeron mapas del código con citas y números de línea inventados; los cazó la verificación adversarial, no el autor
(`INFORME_RELEASE_v2.4.1_15ago2026.md`, líneas 73 a 79).

---

## 1. Estado de la decisión

**[DECISIÓN DEL PROYECTO]** Dejar de depender de Windows es una dirección estratégica **ya tomada**. El destino
elegido es **Linux nativo, manteniendo Python**, con **chronyd** como disciplinador de reloj y **systemd** para
arrancar y supervisar.

**[DECISIÓN DEL PROYECTO]** Esa dirección **no autoriza la migración** ni da su resultado por aprobado de antemano.

**[DECISIÓN DEL PROYECTO]** El experimento tiene cinco funciones, y ninguna de ellas es justificar la decisión ya
tomada:

1. Verificar que el motor se traslada **fielmente** a Linux.
2. Determinar qué dependencias, almacén de ruedas, instalador y pruebas hay que adaptar.
3. Comparar rendimiento y estabilidad.
4. Identificar riesgos y coste real.
5. Establecer las condiciones que habrá que cumplir **antes** de autorizar la migración definitiva.

**[DECISIÓN DEL PROYECTO]** Si Linux falla una prueba, no se oculta ni se acomodan los criterios. Se registra el
bloqueo y se determina si se corrige, si exige otro equipo, o si obliga a replantear la estrategia.

**[DECISIÓN DEL PROYECTO]** Se aceptan los tres veredictos separados: integridad causal, rendimiento monotónico y
calidad temporal UTC.

**[DECISIÓN DEL PROYECTO]** `RESULT.pass` y `CAPTURA_COMPLETA_AUDITADA.json` se conservan intactos, con su
significado estricto actual. No se reutilizan, no se redefinen y no se les cambia el sentido.

**[DECISIÓN DEL PROYECTO]** No se añaden nuevos archivos `.cmd`, ni nuevas configuraciones manuales, ni nuevos pasos
de doble clic.

**[DECISIÓN DEL PROYECTO]** No se usan WSL2 ni Docker sobre Windows como solución definitiva. No se reescribe en Rust
ni en Go salvo que mediciones futuras demuestren una necesidad real.

---

## 2. Base de hechos comprobados

Todo lo que sigue se verificó contra el **paquete sellado de la versión vigente, la 2.4.1**, extraído de
`entregables/JEAN_FLOW_555_META_QUANT_v2.4.1.zip`. Esta es la mitad que ya se puede dar por examinada de la petición
«solicita y examina el paquete sellado de la versión vigente».

### 2.1 El paquete vigente frente al árbol legible

**[HECHO COMPROBADO]** Comparación fichero a fichero entre el árbol 2.3.9 y el paquete sellado 2.4.1:

- `audit.py`, `collector.py`, `rest.py`, `metrics.py`, `normalize.py`, `writer.py` y `reconstruct.py` son **byte a
  byte idénticos**.
- `TimeSync-Common.ps1`, `Test-ClockSync.ps1` y `Test-W32Time.ps1` son **byte a byte idénticos**.
- `launcher.py` cambia en 121 líneas y **ninguna menciona reloj, NTP ni w32tm**. `CLOCK_WARN_MS = 50.0` sigue en la
  línea 47, `clock_preflight` en la 1136 y `clock_postflight` en la 1267.
- `latency.py` cambia en 50 líneas: es el arreglo de ctypes de la versión 2.4.0.

**Consecuencia:** todas las citas de este informe valen para la versión que Jean va a instalar.

### 2.2 Qué depende del reloj de pared y qué no

**[HECHO COMPROBADO]** `audit.py:1187-1204` publica un diccionario `clock_domains` con dos listas. En `monotonic`
están `parse`, `book_apply`, `book_pipeline_total`, `event_loop_lag`, `writer_cooperative_yield`,
`receive_to_writer_start`, `csv_write`, `csv_fsync` y `journal_build`. En `cross_clock` están únicamente
`exchange_to_receive_depth`, `exchange_to_receive_trade` y `trade_time_to_receive`.

**[HECHO COMPROBADO]** `audit.py:1205-1211` añade una nota que dice literalmente que las métricas de reloj cruzado
deben leerse con su banda y **«NUNCA usarse como gate sin banda»**.

**[HECHO COMPROBADO]** Los cinco criterios con umbral (`audit.py:935-966`) evalúan métricas del dominio monotónico.

**[HECHO COMPROBADO]** El reloj de pared **sí** interviene en dos sitios que no son métricas y que la versión
anterior de este informe negaba:

1. **La selección de ventanas del examen de percentiles.** `main.py:23-25` fecha cada línea del registro con
   `datetime.fromtimestamp(record.created)`, que sale del reloj de pared, y la exclusión de calentamiento de la 2.3.9
   elige qué ventanas cuentan usando esas marcas.
2. **El orden de lectura de los segmentos en el replay.** `writer.py:224-225` nombra cada segmento
   `events-<marca UTC>-<número>.csv` y `reconstruct.py:481` los ordena alfabéticamente, de modo que la fecha manda
   sobre el contador.

**[HECHO COMPROBADO]** El segundo caso **falla cerrado**: `reconstruct.py` exige contigüidad de secuencia y la regla
K1 (`reconstruct.py:295`), de modo que un segmento fuera de orden produce un `ReplayError`, no datos corruptos en
silencio.

**[HECHO COMPROBADO]** La restricción más estricta sobre el reloj de pared en todo el código es de **cinco segundos**:
`launcher.py:51` fija `READY_CLOCK_FUTURE_TOLERANCE_S = 5.0`, y `dual_main.py:88-94` valida el testigo de parada con
la misma tolerancia.

### 2.3 Qué hace hoy el gate de reloj

**[HECHO COMPROBADO]** El gate **toma una sola observación**. `launcher.py:1138` y `launcher.py:1271` lo invocan con
`-Samples 20 -WarnMs 50`, pero `Test-ClockSync.ps1:50-51` reenvía **únicamente** `-WarnMs`, y el bloque de parámetros
de `Test-W32Time.ps1:3-6` declara **solo** `$WarnMs`. El `20` se descarta en silencio. Es así también en la 2.4.1.

**[HECHO COMPROBADO]** En la evidencia de campo, el gate **aprobó con un desplazamiento de fase de 17,478 ms**
(`runs/preflight_20260814T081121_393783Z/clock_preflight.json`, campos `abs_phase_offset_ms` y
`phase_offset_ms_raw`, con `pass: true` y `error_code: "PASS"`).

**[HECHO COMPROBADO]** El **mismo informe** de W32Time declaraba en ese instante una demora de raíz de 0,1299577 s y
una dispersión de raíz de 0,0801773 s.

**[ESTIMACIÓN]** Sumando ambas según la definición habitual de distancia de raíz, la incertidumbre que la propia
cadena de reloj anuncia es del orden de **±145 ms**.

**Lectura correcta de este par de datos, y hay que enunciarla con cuidado:** el offset aislado de 17,5 ms **no
certifica una exactitud UTC absoluta de ±50 ms**. No dice que el reloj estuviera mal; dice que ese número, por sí
solo, no sostiene la afirmación que el gate hace con él. Es un residuo de lazo de control, no una cota de exactitud.

**[HECHO COMPROBADO]** El gate se aplica **dos veces**: antes de capturar (`launcher.py:1136`) y al terminar
(`launcher.py:1267`). En etapa certificable, el fallo del segundo pone `result["pass"] = False` y
`status = "CLOCK_POSTFLIGHT_FAILED"` (`launcher.py:2634` en la 2.4.1).

**[HECHO COMPROBADO]** Ese fallo **no borra datos**: escribe `result["evidence_hashes"]` con
`_hash_evidence_files(run_root)` y guarda `RESULT.json`. Lo que se pierde es la etiqueta de certificable, no la
evidencia. La versión anterior de este informe decía «tira tres horas a la basura» y era **falso**.

### 2.4 Qué mide el estimador contra Binance

**[HECHO COMPROBADO]** `rest.py:217-267` estima el desvío con la fórmula de cuatro marcas, pero el comentario del
propio código dice literalmente `T2 = T3 = serverTime`, y `rest.py:264` calcula el retardo como `t4_ns - t1_ns`, el
viaje completo de ida y vuelta sin descontar el tiempo de proceso del servidor.

**[HECHO COMPROBADO]** El endpoint devuelve un único número. No hay estrato, ni dispersión, ni demora de raíz, ni
estado de sincronización, ni seguimiento de deriva.

**[HECHO COMPROBADO]** Se consulta **una sola vez por mercado al arrancar**: `collector.py:335` lo llama desde
`_startup_gates`, que `collector.py:196` invoca una vez antes del bucle de conexión.

**[HECHO COMPROBADO]** `collector.py:344-345` declara literalmente que «La estimación θ̂ es evidencia, no un gate: su
ausencia se registra y no impide capturar».

**[HECHO COMPROBADO]** Valores reales medidos en campo: θ̂ = +47,8 ms con δ = 277 ms en contado, y θ̂ = +49,0 ms con
δ = 276,5 ms en futuros.

**[ESTIMACIÓN]** Con δ = 277 ms la banda demostrable es ±138 ms. Un offset de 48 ms con esa banda **no puede
certificar un límite de 50 ms**.

**[ESTIMACIÓN]** El suelo de esa banda es estructural, no un problema de número de muestras: la mitad del tiempo
mínimo de ida y vuelta. Contra un endpoint HTTPS desde Perú, ese suelo queda muy por encima de 50 ms.

**Nota sobre los dos métodos:** W32Time decía +17,5 ms y el estimador contra Binance decía +47,8 ms en el mismo
periodo. **[HECHO COMPROBADO]** Discrepan en unos 30 ms. **[ESTIMACIÓN]** No es contradicción, porque 30 ms cae
holgadamente dentro de la banda de ±138 ms del segundo método; es precisamente la demostración de que ese método no
resuelve a la escala de 50 ms.

### 2.5 El detector de saltos: qué mide y qué no

**[HECHO COMPROBADO]** Cada fila del CSV lleva dos marcas tomadas en líneas consecutivas del mismo código,
`receive_time_utc_ns` y `receive_time_monotonic_ns` (`collector.py:627-628`). Su diferencia es constante salvo el
ruido de cuantización del reloj monotónico. Una discontinuidad en esa serie indica un salto del reloj de pared.

**[HECHO COMPROBADO]** Ejecutado sobre la corrida `20260814T081136_503806Z_10m_d64fea5560ac`:

| Mercado | Filas analizadas | Rango total de la diferencia | Mayor salto entre filas consecutivas |
|---|---|---|---|
| contado | 418.095 | 19,325 ms | 15,922 ms |
| futuros USDⓈ-M | 799.714 | 19,896 ms | 16,094 ms |

**Enunciado correcto del resultado, corrigiendo una afirmación anterior demasiado fuerte:** el detector **no encontró
ninguna discontinuidad por encima de su umbral de resolución**, que en esa corrida fue de aproximadamente 20 ms.
**No demuestra que el reloj no diera ningún salto.** Sus límites, explícitos:

- **[HECHO COMPROBADO]** Su resolución está acotada por el cuanto de unos 15,6 ms del reloj monotónico de Windows.
  Un salto menor que ese cuanto es invisible para él.
- **[HECHO COMPROBADO]** Solo observa instantes en los que se escribió una fila. Un salto ocurrido en un hueco del
  flujo de mensajes no deja rastro.
- **[HECHO COMPROBADO]** Solo cubre la ventana capturada, no el preflight ni el postflight.

**[ESTIMACIÓN]** Con ese umbral, un salto del orden del desvío de campo reportado (unos 373 ms) **sí** habría sido
visible. Un salto de 10 ms no.

**[HIPÓTESIS]** Como el detector no vio discontinuidades y la cola de 5 segundos de `exchange_to_receive` sí existe,
la explicación más probable de esa cola es retraso real de entrega (red o degradación del proceso por Windows) y no
un movimiento del reloj. **No está demostrado.** La métrica que la registra es de reloj cruzado y, por construcción,
no distingue «el mensaje tardó» de «el reloj se movió».

**[HECHO COMPROBADO]** Datos de esa cola: `exchange_to_receive_depth` con mediana de 90,5 ms y percentil 99 de
5.036 ms en contado; mediana de 94,7 ms y percentil 99 de 3.460 ms en futuros. Ninguna métrica monotónica de esa
misma foto registra un parón comparable: `event_loop_lag` marca 22 ms de percentil 99 y 58 ms de máximo.

### 2.6 Sobre W32Time y los saltos

**[HECHO COMPROBADO]** El perfil público que el paquete configura usa un intervalo de sondeo de 2048 segundos, unos
34 minutos (`Configure-W32Time.ps1`, perfil `PublicInternet`).

**Corrección de una afirmación anterior:** decir que «disciplinar el reloj inyecta saltos» era incorrecto. Lo
correcto: **[HECHO COMPROBADO]** el protocolo del proyecto prohíbe expresamente cualquier `resync` durante la captura
(`README_NTP_WINDOWS.md:18`), precisamente porque un movimiento del reloj en pleno vuelo contaminaría las métricas
cruzadas. **[ESTIMACIÓN]** W32Time corrige normalmente **deslizando** el reloj poco a poco, y solo escalona cuando el
desvío supera su umbral de escalón. **[HIPÓTESIS]** Durante una certificación de 160 minutos hay varias ocasiones de
sondeo, y **si** alguna produjera un escalón, sería el único modo de fallo de reloj que daña las diferencias dentro
de la corrida. No hay evidencia de que haya ocurrido.

### 2.7 La superficie que se abandona al migrar

**[HECHO COMPROBADO]** El subsistema de reloj para Windows son 2.202 líneas de PowerShell repartidas en diez
ficheros, con 63 expresiones regulares que leen la salida **traducida** de `w32tm.exe` y 24 códigos de error
distintos. `TimeSync-Common.ps1:247` busca literalmente «Phase Offset» o «Desplazamiento de fase» o «Desfase», y
existe un código `STATUS_LOCALE_UNSUPPORTED` para cuando Windows contesta en un idioma no previsto.

**[HECHO COMPROBADO]** El almacén de ruedas contiene 20 paquetes, de los cuales **7 son `cp312-win_amd64`**
(aiohttp, frozenlist, multidict, orjson, propcache, websockets, yarl) y 13 son puros, válidos en cualquier
plataforma.

**[HECHO COMPROBADO]** Hoy Jean maneja **cinco puntos de entrada de doble clic**, y cuatro viven **fuera** del
paquete sellado: `ARREGLAR_RELOJ.cmd`, `CERTIFICAR_BTCUSDT.cmd`, `INSTALAR_EN_C_v241.cmd` y
`RECOGER_EVIDENCIA_TODO.cmd`, sellados aparte en `entregables/SELLOS.sha256`. Solo `INICIAR.cmd` está dentro del
manifiesto de 144 archivos.

---

## 3. Lo que NO está probado, y hay que decirlo antes de gastar una semana

**[HECHO COMPROBADO]** El único `RESULT.json` disponible pertenece a la sesión `d64fea5560ac`, de la versión
**2.3.4**. Su estado es `DATA_GATES_FAILED` y sus claves de nivel superior **no incluyen** `clock_preflight` ni
`clock_postflight`.

**[HECHO COMPROBADO]** En esa sesión **el reloj pasó** (17,478 ms, `error_code: "PASS"`). El fallo registrado fue de
**decodificación**: `audit_metrics.json` no contiene un informe sino un rastro de excepción de Python con
`UnicodeEncodeError` de cp1252 en la posición 538.

**[HECHO COMPROBADO]** Reproduciendo la salida que emite `audit.py:1180`, el primer carácter que cp1252 no sabe
escribir es la **θ** de la propia nota del reloj, en la frase «debe leerse con la banda θ̂±δ/2». El texto que explica
que la métrica del reloj debe leerse con su banda es lo que tumbó aquella certificación. Ya corregido desde la 2.3.5.

**Conclusión, sin adornos:** **los archivos entregados hasta hoy no demuestran ningún fallo de reloj en la versión
2.3.9 ni posterior.** Toda la discusión sobre el reloj se apoya en un informe de campo escrito, no en un `RESULT.json`
en la mano.

### Lo que hay que pedir, con nombre y apellido

De **la última sesión que realmente falló**, la reciente, no la de agosto:

1. `RESULT.json`
2. `clock_preflight.json` (está en `runs\preflight_<marca>\`)
3. `clock_postflight.json` (está en la carpeta de la sesión)
4. `jean_flow_metrics.jsonl`
5. Los `audit_*.json` de la carpeta `capture`

**[DECISIÓN DEL PROYECTO]** No se añade ningún `.cmd` nuevo para recoger esto: `RECOGER_EVIDENCIA_TODO.cmd`, que ya
existe y ya está sellado, junta la carpeta `runs\` completa en un zip. Es el mecanismo actual y basta.

**[ESTIMACIÓN]** Examinar ese paquete cuesta menos de una tarde. Cualquier plan de semanas o meses que se firme antes
de mirarlo se estará apoyando en una causa no probada.

---

## 4. Lo que se corrige de la versión anterior de este informe

Se retiran o se reformulan estas afirmaciones. Se listan sin excusas porque el proyecto exige reconocer los errores
propios sin rodeos.

| Afirmación anterior | Estado | Formulación correcta |
|---|---|---|
| «El postflight tira tres horas de captura a la basura» | **RETIRADA, era falsa** | Niega el certificado y conserva CSV, hashes y evidencia (`launcher.py:2634`). |
| «La tolerancia al desvío de reloj es ilimitada» (dos veces) | **RETIRADA, era falsa** | Está acotada por los cinco segundos de `launcher.py:51` y por el signo físico de `exchange_to_receive`. |
| «La reconstrucción causal no depende en absoluto del reloj» | **RETIRADA, era falsa** | El orden de segmentos depende del nombre del fichero, que lleva la marca de pared. Falla cerrado. |
| «El detector demuestra que el reloj no dio ningún salto» | **REFORMULADA** | No detectó discontinuidades por encima de su umbral de unos 20 ms. No demuestra ausencia de saltos. |
| «Disciplinar el reloj inyecta saltos» | **REFORMULADA** | W32Time normalmente desliza; un escalón es posible y sería el modo dañino, pero no hay evidencia de que ocurriera. |
| «La ventaja de chronyd se reduce a que lo hace por ti y lo hace mejor» | **RETIRADA, minimizaba de más** | Ver sección 5. |
| «La prueba desde USB tiene riesgo cero» | **RETIRADA, era falsa** | Ver sección 8. |
| «Seis corridas de diez minutos deciden la migración» | **RETIRADA, insuficiente** | Ver sección 7. |
| Reformar `RESULT.pass` para alojar los tres veredictos | **RETIRADA, violaba el protocolo** | Ver sección 6. |
| El certificado causal nuevo abriría la Fase 2 | **RETIRADA, era peligrosa** | Ver sección 6.4. |

---

## 5. chronyd frente a un cliente propio, sin minimizar

La versión anterior sostenía que la distancia entre ambos era pequeña. Era una minimización y se retira.

**[HECHO COMPROBADO]** Un cliente SNTP propio obtiene del paquete las cuatro marcas reales del protocolo y la
cabecera completa, incluidos estrato, demora de raíz, dispersión de raíz e indicador de salto. Eso es cierto y sigue
siendo cierto: esos campos viajan en el protocolo.

**Lo que un cliente propio NO da, y chronyd sí:**

- **[ESTIMACIÓN]** Un lazo de control con fichero de deriva persistente, que aprende la tasa de deriva del oscilador
  entre arranques. Un cliente que solo mide empieza de cero cada vez.
- **[ESTIMACIÓN]** Disciplina del reloj del sistema operativo, no solo medición. chronyd corrige; un cliente propio
  observa y anota.
- **[ESTIMACIÓN]** Algoritmos de selección de fuente, detección de falsos tickers y filtrado que llevan años de
  endurecimiento en producción y millones de instalaciones.
- **[ESTIMACIÓN]** Exposición de su propio estado de calidad en forma legible por máquina y **no localizada**, que es
  exactamente lo que hoy falta y lo que obliga a leer texto traducido de `w32tm.exe`.

**Conclusión honesta:** un cliente propio es un **instrumento de medida**; chronyd es un **lazo de control con
instrumentación incluida**. Presentarlos como equivalentes fue un error. Para el objetivo declarado —dejar de
depender de Windows y tener evidencia de reloj auditable— **chronyd es la elección correcta**, y esa es además la
dirección ya decidida.

**[HIPÓTESIS]** El único riesgo que chronyd **no** elimina es que la red de Jean bloquee el tráfico de reloj. Eso hay
que medirlo, no suponerlo, y se mide en la fase 2.

---

## 6. Los tres veredictos, sin tocar nada de lo existente

**[DECISIÓN DEL PROYECTO]** Se conservan los tres veredictos separados. La cuestión es **cómo** se implementan sin
violar la regla de cero cambios silenciosos.

### 6.1 Lo que NO se toca

**[HECHO COMPROBADO]** Hoy el veredicto es un único booleano por mercado, construido en `audit.py:1138-1146`
combinando seis fuentes con un «y» lógico, y `RESULT.pass` recoge el resultado global.

**[DECISIÓN DEL PROYECTO]** `RESULT.pass` conserva **exactamente** su significado actual y su criterio actual.
`CAPTURA_COMPLETA_AUDITADA.json` conserva **exactamente** su significado actual y su condición de emisión actual.
Ninguno de los dos se reutiliza, se redefine ni se relaja. Un consumidor existente de cualquiera de los dos no debe
notar diferencia alguna.

### 6.2 Lo que se propone añadir ahora, y solo esto

**Un marcador causal nuevo, deliberadamente limitado.** Nombre propuesto: `INTEGRIDAD_CAUSAL.json`, junto al
`RESULT.json` de la corrida, **adicional** y nunca sustitutivo.

Contenido propuesto: el veredicto de integridad causal y el de rendimiento monotónico por separado, más la calidad
temporal UTC como campo informativo que **puede valer `UNKNOWN`** sin que eso invalide nada.

- **Integridad causal:** identidad, replay causal, integridad del diario, determinismo de la re-repetición,
  contadores de fallo a cero, compromiso de captura, ausencia de ficheros parciales, y de forma **explícita** que el
  motor terminó con código cero y que la validación del manifiesto de sesión pasó. **[HECHO COMPROBADO]** Estos dos
  últimos forman parte del criterio actual en `launcher.py:1983-1987`, y omitirlos al escribir el marcador nuevo
  abriría un camino de aprobación accidental.
- **Rendimiento monotónico:** los cinco umbrales de percentil 99 tal como están hoy, sin mover un número, más
  capacidad, desalojo, actividad y estado terminal.
- **Calidad temporal UTC:** una clase publicada. Valores propuestos: `DEMOSTRADA`, `INSUFICIENTE` o `UNKNOWN`. En
  esta entrega **nunca** puede negar nada.

**[DECISIÓN DEL PROYECTO]** El marcador nuevo es **informativo y limitado**. No sustituye a `RESULT.pass`, no lo
contradice y no puede emitirse en su lugar.

### 6.3 El perfil UTC calificado: diseñado, no implementado

**[DECISIÓN DEL PROYECTO]** Se **diseña y documenta** un segundo certificado, el de calidad UTC calificada, en el que
sí sería obligatorio demostrar que el offset **más** su incertidumbre cae dentro del límite. Pero **no se implementa
hasta que exista un uso concreto que lo necesite**.

Diseño propuesto, para dejarlo escrito y no volver a discutirlo:

- Criterio: |θ̂| + δ/2 ≤ L, con L declarado en el propio certificado. **No** |θ̂| ≤ L, que es el error que comete el
  gate actual.
- Fuente: chronyd, leyendo su estado en forma legible por máquina.
- Evidencia sellada: las muestras crudas suficientes para que un auditor recalcule la banda por su cuenta.
- **[ESTIMACIÓN]** Con la instrumentación actual contra Binance, ese criterio es inalcanzable a 50 ms. Con chronyd
  sobre Linux y una red que permita el tráfico de reloj, es alcanzable. Esto se mide, no se supone.

**Razón de no implementarlo ahora, dicha con franqueza:** hoy **[HECHO COMPROBADO]** no existe en el proyecto ningún
consumidor que necesite exactitud UTC absoluta. No hay otro mercado, ni noticias, ni conjunto de datos externo con el
que cruzar por marca de tiempo. Implementar un certificado sin consumidor es añadir un artefacto que mantener, y el
proyecto ya sufre de proliferación de artefactos.

### 6.4 La Fase 2 no se abre con esto

**[DECISIÓN DEL PROYECTO]** El marcador causal nuevo **no habilita automáticamente la Fase 2**.

**[HECHO COMPROBADO]** La puerta de la Fase 2 es hoy la existencia de `runs\CAPTURA_COMPLETA_AUDITADA.json`, y ese
archivo no cambia.

**[HECHO COMPROBADO]** La elegibilidad real de la Fase 2 depende de decisiones que **no están tomadas**:
`SKILL_QUANT_DEV_SENIOR.md:13` lista el «horizonte objetivo del modelo» como decisión material aún pendiente, y
`SKILL_QUANT_DEV_SENIOR.md:51` habla de «un horizonte explícito» sin declarar en qué reloj se mide.

**[ESTIMACIÓN]** Si el horizonte se define por índice de evento o por reloj monotónico, la exactitud UTC absoluta no
entra en las features ni en el objetivo. Si se define por reloj de pared, sí entra. **La decisión sobre el horizonte
debe preceder a cualquier afirmación sobre qué calidad de reloj necesita la Fase 2.**

---

## 7. El plan por fases

Cada fase entrega algo por sí sola, se puede aprobar o rechazar por separado, y **ninguna modifica código sin
autorización expresa**. Este informe solo pide autorización para la fase 0.

### Fase 0 — Evidencia y línea base (sin código)

**Qué se hace:** examinar la última sesión que realmente falló, con los cinco archivos de la sección 3, recogidos con
el `RECOGER_EVIDENCIA_TODO.cmd` que ya existe. Y correr el auditor de métricas sobre una captura corta con el motor
2.4.1 ya instalado, para tener una línea base en Windows con la versión vigente y no con datos de la 2.3.4.

**Qué resuelve:** que hoy nadie ha probado que el fallo reciente fuera del reloj, y que toda la línea base disponible
procede de un motor cuatro versiones anterior y con dos defectos ya corregidos (el cuanto del temporizador y la
codificación).

**Cómo se comprueba:** existe en disco el `RESULT.json` del fallo y se puede nombrar su causa con una cita.

**Qué necesita de Jean:** ejecutar un `.cmd` que ya tiene y subir un zip. **Ningún paso nuevo.**

**[ESTIMACIÓN]** Coste: una tarde.

---

### Fase 1 — Prueba de fidelidad por replay idéntico

**Esta prueba responde a UNA sola pregunta: ¿el motor produce en Linux exactamente lo mismo que en Windows?** No
responde nada sobre rendimiento, ni sobre red, ni sobre si merece la pena migrar.

**Qué se hace:** se toma un diario ya capturado y sellado, se pasa por `reconstruct()` en Windows y en Linux, y se
comparan los SHA-256 de los informes de replay. **[HECHO COMPROBADO]** El auditor ya ejecuta el replay dos veces y
compara sellos, de modo que el mecanismo existe. Se ejecuta además la batería de pruebas offline completa en Linux.

**Por qué esta prueba es buena:** es determinista, no depende del reloj, no depende de la red, no depende del
planificador, y se puede correr tantas veces como se quiera sin molestar a Jean ni tocar su máquina.

**Criterios numéricos, fijados aquí y antes de ejecutar:**

| Qué | Criterio de aprobación | Qué significa fallar |
|---|---|---|
| SHA-256 de los informes de replay | **Idénticos byte a byte** entre plataformas | Bloqueo. El port no es fiel. No se continúa. |
| Batería de pruebas offline en Linux | Mismo número de pruebas superadas que en Windows | Bloqueo, salvo que cada omisión nueva se justifique por escrito y se registre. |
| Ruedas del almacén reconstruidas para Linux | Las 7 binarias disponibles en las versiones **exactas** del fichero de bloqueo, con sello verificado contra una segunda fuente | Bloqueo. Sin ruedas reproducibles no hay instalación offline. |
| Verificación de integridad del árbol | Pasa en Linux con los mismos sellos | Bloqueo. |

**[DECISIÓN DEL PROYECTO]** Si el replay no sale idéntico, **se registra el bloqueo y se investiga**. No se ajusta la
tolerancia, no se declara «diferencia aceptable» y no se continúa a la fase 2.

**[ESTIMACIÓN]** Coste: de una a dos semanas, la mayor parte en el almacén de ruedas y en la adaptación de las
pruebas que hoy simulan Windows.

**Qué necesita de Jean:** nada. Esta fase no toca su máquina.

---

### Fase 2 — Prueba de rendimiento, red y estabilidad con capturas reales

**Esta prueba responde a otra pregunta distinta: ¿el sistema se comporta al menos igual de bien en Linux, con la red
real y durante horas?** No sustituye a la fase 1 ni se ejecuta antes que ella.

**Qué se hace:** capturas reales de **10, 30 y 120 minutos**, la misma escalera del modo 3, en Linux y en Windows,
**intercaladas** y en franjas horarias equivalentes para que las condiciones de mercado y de red no favorezcan a una
plataforma.

**Sobre dónde correr Linux, y aquí hay una tensión real que no se puede disimular:**

- **[ESTIMACIÓN]** La única comparación limpia de rendimiento es **misma máquina, misma red**. Eso implica arrancar
  la laptop de Jean con Linux.
- **[ESTIMACIÓN]** Un mini-PC dedicado elimina todo riesgo para su equipo, pero introduce una variable nueva: es otro
  procesador y otro disco, así que la comparación deja de ser limpia y pasa a ser «este equipo Linux contra aquel
  equipo Windows».
- **[ESTIMACIÓN]** Una máquina en la nube sirve para estabilidad y fidelidad, pero **no** para comparar la red de
  Jean, que es justamente lo que interesa.

**No hay opción sin coste.** La decisión es de Jean y este informe no la toma por él.

**Criterios numéricos, fijados aquí y antes de ejecutar:**

| Métrica | Límite vigente | Criterio en Linux |
|---|---|---|
| `parse` percentil 99 | 5 ms | Cumple en **al menos 5 de 6** corridas de cada duración |
| `book_apply` percentil 99 | 5 ms | Igual |
| `book_pipeline_total` percentil 99 | 5 ms | Igual |
| `writer_cooperative_yield` percentil 99 | 5 ms | Igual |
| `event_loop_lag` percentil 99 | 40 ms | Igual |
| Contadores de fallo y overflows | 0 | 0 en todas las corridas |
| Etapas sanas completas | 600 s, 1800 s, 7200 s exactos | Se completan sin reinicios de salud |
| Tráfico de reloj | — | Se registra si sale de la red de Jean y cuál es el retardo mínimo a los servidores |

**[HECHO COMPROBADO]** El límite de 40 ms de `event_loop_lag` está justificado en el propio código por el cuanto de
15,625 ms del temporizador de Windows.

**[DECISIÓN DEL PROYECTO]** Ese límite **no se relaja** para Linux bajo ningún concepto. **[HIPÓTESIS]** Es probable
que en Linux el número correcto sea más estricto; si las mediciones lo sostienen, endurecerlo será un cambio
explícito con versión nueva, nunca una relajación.

**[DECISIÓN DEL PROYECTO]** No se incluye `exchange_to_receive` entre los criterios. **[HECHO COMPROBADO]** Es de
reloj cruzado y el ruido de red la domina por dos órdenes de magnitud. Se publica, no se usa como criterio.

**Por qué 10, 30 y 120 y no solo diez minutos:** **[ESTIMACIÓN]** la corrida de 120 minutos es la única que puede
revelar deriva térmica, fugas de memoria, rotación de segmentos y comportamiento del disciplinador de reloj a lo
largo de varias ocasiones de sondeo. Seis corridas de diez minutos no pueden decidir una migración, y afirmarlo en la
versión anterior de este informe fue un error.

**[ESTIMACIÓN]** Coste de máquina: unas 9 horas de captura por plataforma para una tanda completa, más repeticiones.
Con corridas intercaladas, varios días de calendario.

---

### Fase 3 — Adaptación de dependencias, instalador y pruebas

Solo se emprende si las fases 1 y 2 aprueban. **[DECISIÓN DEL PROYECTO]** No se añade ningún paso de doble clic
nuevo: el objetivo declarado es que Linux tenga **un único punto de entrada**, y de paso resolver que hoy haya cinco
en Windows con cuatro fuera del paquete sellado.

Alcance a determinar en la fase 1, no ahora: almacén de ruedas para Linux, sustitución de la superficie PowerShell
por lectura del estado de chronyd, unidad de systemd para arrancar y supervisar, instalador equivalente probado en
frío y contra paquete adulterado, y las pruebas que hoy simulan Windows.

---

### Fase 4 — Condiciones para autorizar la migración definitiva

**[DECISIÓN DEL PROYECTO]** La migración se autoriza cuando, y solo cuando, se cumplan todas:

1. El replay es idéntico byte a byte entre plataformas.
2. La batería de pruebas pasa en Linux con el mismo recuento, sin omisiones nuevas injustificadas.
3. Las capturas de 10, 30 y 120 minutos cumplen los umbrales vigentes sin relajar ninguno.
4. El almacén de ruedas para Linux es reproducible offline y con sellos verificados.
5. El instalador para Linux está probado en frío y contra paquete adulterado.
6. Existe un único punto de entrada, no cinco.
7. Está escrito qué se hace con la evidencia histórica capturada en Windows, que **[DECISIÓN DEL PROYECTO]** es
   intocable y debe seguir siendo auditable desde la plataforma nueva.
8. Está escrito el plan de vuelta atrás si algo falla en producción.

---

## 8. Registro de bloqueos

**[DECISIÓN DEL PROYECTO]** Cuando Linux falle una prueba, se escribe una entrada con esta forma, y no se continúa
hasta clasificarla:

```
BLOQUEO <número> — <título>
  Fase:            <1, 2 o 3>
  Qué falló:       <hecho medido, con el número>
  Criterio:        <el criterio fijado antes del experimento>
  Clasificación:   SE CORRIGE | EXIGE OTRO EQUIPO | REPLANTEA LA ESTRATEGIA
  Evidencia:       <rutas de los archivos>
  Decisión:        <pendiente de Jean, o resuelta y cómo>
```

**[DECISIÓN DEL PROYECTO]** Está prohibido: ajustar un criterio después de ver el número, promediar entre plataformas
para disimular un fallo, declarar «diferencia aceptable» sin cuantificarla, o presentar como aprobada una fase con un
bloqueo abierto.

---

## 9. Riesgos, con su magnitud honesta

**Arranque desde memoria USB.** La versión anterior decía «riesgo cero» y **era falso**. **[ESTIMACIÓN]** El riesgo
es bajo pero no nulo: hay que entrar en el firmware, puede hacer falta desactivar el arranque seguro, y el cifrado de
disco de Windows 11 puede pedir la clave de recuperación al detectar cambios en la configuración de arranque. **Antes
de intentarlo hay que tener a mano la clave de recuperación de BitLocker.** El riesgo real no es perder datos: es
dejar la máquina sin arrancar hasta que se recupere la clave.

**[DECISIÓN DEL PROYECTO]** Nunca arranque dual en la única máquina de Jean. Redimensionar una partición cifrada es
un riesgo que este proyecto no necesita correr.

**Red que bloquea el tráfico de reloj.** **[HECHO COMPROBADO]** En el entorno de pruebas de esta sesión, las
consultas a los servidores de hora por el puerto habitual dieron tiempo de espera agotado. Eso no dice nada sobre la
red de Jean, pero obliga a medirlo. **[HIPÓTESIS]** Su red probablemente lo permite, porque su propio informe de
W32Time registra estrato 2 y un servidor público que le respondió. Hay que confirmarlo, no suponerlo.

**Doble mantenimiento durante la transición.** **[ESTIMACIÓN]** Mientras la migración no termine, habrá dos árboles,
dos almacenes de ruedas y dos manifiestos. En un proyecto que sostiene una sola persona, ese es el coste continuo más
alto y el que más conviene acortar.

**Fase 2 y la GPU.** **[HIPÓTESIS]** La RTX 3050 y CUDA funcionan en Linux, pero eso no se ha verificado para este
proyecto y no debe darse por hecho al planificar. Si la máquina de captura acaba siendo un mini-PC sin GPU, hay que
decidir dónde vive la Fase 2.

---

## 10. Lo que NO se hace

- **No se toca `RESULT.pass` ni `CAPTURA_COMPLETA_AUDITADA.json`.**
- **No se baja ni se mueve ningún umbral**, ni el de 50 ms ni los de percentil 99.
- **No se fabrica nunca un PASS.** Si la calidad de reloj no se puede demostrar, se publica `UNKNOWN`.
- **No se añaden archivos `.cmd`, configuraciones manuales ni pasos de doble clic.**
- **No se usan WSL2, Docker ni máquina virtual como solución definitiva.** **[ESTIMACIÓN]** En los tres casos el
  reloj y el planificador de debajo siguen siendo los del anfitrión, de modo que la evidencia diría «Linux» mientras
  el sustrato sería Windows.
- **No se escribe Rust ni Go**, ni ahora ni como compromiso futuro, salvo que las mediciones demuestren la necesidad.
- **No se implementa el certificado UTC calificado** hasta que exista un consumidor concreto.
- **No se toca la evidencia histórica.**

---

## 11. Qué se pide ahora

**Autorización solo para la fase 0**, que no modifica ni una línea de código:

1. Que Jean ejecute `RECOGER_EVIDENCIA_TODO.cmd`, que ya tiene y ya está sellado, sobre la última sesión que
   realmente falló, y suba el zip.
2. Que instale la versión 2.4.1 con el instalador que ya tiene, y corra una captura corta para tener línea base con
   el motor vigente.

Con eso sobre la mesa se sabrá si el fallo reciente fue del reloj o de otra cosa, y la fase 1 podrá presupuestarse
contra datos reales en vez de contra un informe escrito.

**Y una decisión que solo Jean puede tomar, y que conviene tomar antes de la fase 2:** dónde correr Linux. Misma
laptop desde USB, que da la comparación limpia con riesgo bajo pero no nulo; mini-PC dedicado, que da riesgo cero
pero comparación sucia; o máquina en la nube, que sirve para fidelidad y estabilidad pero no para medir su red.

---

*Fin del informe. Ninguna afirmación sobre el código carece de archivo y línea, cada afirmación lleva su etiqueta, y
las que no se pudieron verificar están marcadas como hipótesis en vez de rellenarse con suposiciones.*
