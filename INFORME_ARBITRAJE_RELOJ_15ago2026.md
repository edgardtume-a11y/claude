# INFORME DE ARBITRAJE — El gate de reloj de JEAN_FLOW 555

**Fecha:** 15 de agosto de 2026
**Asunto:** disputa entre la Postura A (dejar de disciplinar el reloj y medirlo) y la Postura B (la crítica, que propone migrar a Linux nativo con chronyd).
**Árbol de código leído:** `/tmp/claude-0/-home-user-claude/ed460f64-92d2-523b-bae6-9d78269266ab/scratchpad/unz/INSTALACION/JF239/555` — versión **2.3.9**, el único árbol legible.

> **Advertencia de método, la primera de todas.** El cuerpo de este informe se redactó leyendo el árbol de la versión
> 2.3.9. **Esa incertidumbre quedó resuelta después:** se extrajo el ZIP sellado de la versión 2.4.1 desde
> `entregables/JEAN_FLOW_555_META_QUANT_v2.4.1.zip` y se comparó fichero a fichero. Resultado:
>
> - `audit.py`, `collector.py`, `rest.py`, `metrics.py`, `normalize.py`, `writer.py` y `reconstruct.py` son
>   **byte a byte idénticos** entre 2.3.9 y 2.4.1.
> - `TimeSync-Common.ps1`, `Test-ClockSync.ps1` y `Test-W32Time.ps1` son **byte a byte idénticos**.
> - `launcher.py` cambia en 121 líneas, pero **ninguna menciona reloj, NTP ni w32tm** (diff filtrado, cero
>   coincidencias). `CLOCK_WARN_MS = 50.0` sigue en la línea 47, `clock_preflight` en la 1136 y `clock_postflight`
>   en la 1267, idénticas.
> - `latency.py` cambia en 50 líneas: es el arreglo de ctypes de la versión 2.4.0.
>
> **Por tanto todas las citas de este informe valen para la 2.4.1**, con una sola corrección de numeración que se
> indica en su sitio: el veto del postflight pasa de `launcher.py:2541` a **`launcher.py:2634`**, desplazado por el
> código del navegador que añadió la 2.4.1, no por un cambio de lógica.
>
> Las citas marcadas como **(verificado hoy)** se abrieron y leyeron directamente. Esta disciplina existe porque
> nueve agentes en paralelo produjeron citas inventadas en `INFORME_RELEASE_v2.4.1_15ago2026.md` líneas 73 a 79.

---

## 1. Veredicto en cinco líneas

1. La Postura A tenía razón en el diagnóstico central y está confirmada por el código: ningún criterio con umbral del producto lee el reloj de pared, y el auditor prohíbe expresamente usar como gate la única métrica que sí lo lee.
2. La crítica tenía razón en casi todas sus objeciones de detalle, y en una de ellas la Postura A fue simplemente incorrecta: el postflight **no borra ni tira tres horas de captura**, sino que **niega el certificado conservando intactos los CSV, los hashes y toda la evidencia**.
3. La crítica se equivoca en la proporción y en la secuencia: propone cambiar de sistema operativo, que cuesta meses, para arreglar algo que se arregla en semanas y sin tocar el sistema operativo.
4. **Se hace lo siguiente:** separar el certificado en tres veredictos independientes, sustituir el gate de 50 milisegundos por una banda de incertidumbre medida y publicada, y detectar los saltos de reloj con nuestros propios datos. Todo ello en Windows, sin comprar nada y sin poner en riesgo la máquina de Jean.
5. La migración a Linux **no se aprueba ni se rechaza hoy**: queda condicionada a una medición concreta, barata y reversible que se describe en la sección 7 y que nadie ha hecho todavía.

---

## 2. Lo que la crítica acertó, punto por punto

Empiezo por el error más grave de la Postura A, que es mío y lo reconozco sin rodeos.

### B5 — «El postflight tira o borra tres horas de captura» fue INCORRECTO

Esta afirmación era falsa y la retiro. Lo que hace el código, verificado hoy:

- En `launcher.py:2541` de la versión 2.3.9 — **`launcher.py:2634` en la 2.4.1** (ambas verificadas hoy) — el fallo del control de reloj al cierre pone `result["status"] = "CLOCK_POSTFLIGHT_FAILED"`.
- En las líneas inmediatamente siguientes escribe `result["clock_postflight"]`, calcula `result["evidence_hashes"] = _hash_evidence_files(run_root)`, guarda `RESULT.json` con `atomic_write_json` y relanza la excepción (verificado hoy).
- `_hash_evidence_files` está en `launcher.py:2031` y sella todos los ficheros con extensión `.csv`, `.json`, `.jsonl`, `.partial` y `.txt` bajo la carpeta de la corrida (verificado hoy, `launcher.py:2032`).

Es decir: **no se borra un solo byte**. Los CSV siguen ahí, los hashes se calculan y se guardan, y la evidencia queda sellada. Lo único que se pierde es la etiqueta de «certificable». La frase correcta es «el postflight **niega el certificado**», no «tira tres horas a la basura». La diferencia no es cosmética: cambia por completo la urgencia del problema. Perder datos sería una emergencia; perder una etiqueta es un defecto de diseño que se corrige con calma y con método.

### B2 — «Binance `/api/v3/time` es equivalente a NTP» es INCORRECTO

Confirmado, y el propio código lo dice. En `rest.py:260-261` el comentario es literal: `T2 = T3 = serverTime` (verificado hoy). En `rest.py:264` el retardo se calcula como `t4_ns - t1_ns`, es decir el tiempo de ida y vuelta completo, sin descontar el tiempo de proceso del servidor (verificado hoy). El diccionario que devuelve la función contiene únicamente `theta_hat_ns`, `delta_ns`, `server_time_ms`, `t1_utc_ns` y `t4_utc_ns`.

El punto exacto, dicho con precisión: **el estimador es el mismo fórmula que usa NTP**. Lo que falta es todo lo demás. Al suponer que las dos marcas del servidor son la misma, el tiempo que el servidor tarda en responder entra dentro del retardo y además sesga la estimación. Y no hay estrato, ni dispersión de raíz, ni demora de raíz, ni estado de sincronización, ni deriva. Binance devuelve un número; NTP devuelve un número acompañado de su propia declaración de calidad. La frase correcta es: **no es otro algoritmo, es el mismo algoritmo con una entrada degradada y sin metadatos**.

### B3 — La aritmética que invalida la conclusión optimista

Confirmado, y además la crítica se quedó corta a su favor. La medición histórica de campo fue una estimación de 45,1 milisegundos con un retardo de 274 milisegundos, lo que da una banda de más menos 137 milisegundos y un error máximo posible de 182,1 milisegundos. Con esa observación no se puede certificar un límite de 50 milisegundos. Correcto.

Lo que la crítica no dijo, y que refuerza su propia posición: **el problema no es que sea una sola observación, es estructural**. La banda demostrable es la mitad del retardo, y el retardo nunca puede bajar del tiempo mínimo de ida y vuelta del camino. Desde Perú hasta Binance ese mínimo es del orden de 200 milisegundos o más, lo que sitúa el suelo de la banda en torno a 100 a 140 milisegundos. Ni con un millón de muestras se baja de ahí. Contra `/api/v3/time` **jamás** se podrá certificar 50 milisegundos. Esto liquida la discusión sin necesidad de discutir la observación histórica.

### B4 — «La corrección por fila ya está lista» es FALSO

Confirmado. En `collector.py:335-360` (verificado hoy) la llamada a `fetch_server_time` se hace una sola vez, desde los controles de arranque, y su resultado se guarda únicamente como dos indicadores de métrica: `clock_offset_theta_hat_ns` y `clock_offset_delta_ns`. Es más: el propio comentario del código en `collector.py:344-345` dice literalmente «La estimación θ̂ es evidencia, no un gate: su ausencia se registra y no impide capturar» (verificado hoy).

Por tanto, hoy: se consulta una vez al arrancar, no se sigue la deriva durante los 160 minutos de la certificación, no se guarda el desvío ni su incertidumbre fila por fila, y no se corrige `receive_time_utc_ns`. La crítica tiene toda la razón. **La corrección por fila no está lista: está por escribir.** Y es, con diferencia, el trabajo que más mejoraría la calidad de la evidencia.

### B1 — «El gate no protege nada útil» es PARCIAL

La crítica acierta en que la Postura A exageró. El gate sí protege algo. Pero es mucho menos de lo que la crítica sugiere, y esto lo desarrollo en la sección 3, porque es donde la crítica también exagera.

Lo que es cierto y hay que reconocer: decir «no protege NADA» era falso. Sí protege una cosa concreta, la plausibilidad del signo de la métrica `exchange_to_receive`. Con el reloj atrasado más de unos 91 milisegundos, más de la mitad de las muestras salen negativas, es decir latencias físicamente imposibles. Ese número sale del percentil 50 real de esa métrica en la corrida de campo. Es un bien real, y hay que nombrarlo en vez de negarlo.

### B6 — «Python directo por socket elimina el problema» es INCORRECTO

Confirmado, y es de sentido común técnico. Escribir el cliente de reloj en Python en vez de en PowerShell elimina PowerShell y elimina W32Time del camino crítico. No elimina Windows. El planificador sigue ahí, la gestión de energía por ventana en primer plano sigue ahí, y la resolución del temporizador del sistema sigue ahí. De hecho el propio código lo documenta: `audit.py:669-696` (verificado hoy) explica con todo detalle que el límite del retraso del bucle de eventos se subió de 20 a 40 milisegundos precisamente por el cuanto de 15,625 milisegundos del temporizador de Windows, y `audit.py:696` fija `EVENT_LOOP_P99_LIMIT_MS = 40.0`.

Es decir: cambiar de lenguaje no cambia el sustrato. La crítica tiene razón y hay que decirlo con claridad, porque es el argumento que más honestamente sostiene su propuesta de migrar.

### B7 — No hay evidencia del fallo reciente

Confirmado y es el punto de método más importante de todo el expediente. El único `RESULT.json` disponible es el de la corrida `20260814T081136_503806Z_10m_d64fea5560ac`, que falló con estado `DATA_GATES_FAILED` y cuyas claves de nivel superior no incluyen `clock_preflight` ni `clock_postflight`. Esa corrida falló por un problema de codificación de caracteres en los informes, no por el reloj.

**Nadie puede afirmar todavía que el último fallo de Jean fue el reloj.** Se está a punto de gastar entre tres semanas y cuatro meses en arreglar una causa que no está probada. La acción más barata de todo este expediente, y no aparece en ningún plan, es pedirle a Jean la carpeta `runs/` y el `RESULT.json` de su fallo reciente. Cuesta una tarde y puede ahorrar meses.

---

## 3. Lo que la crítica no vio, o exageró

### La comparación justa no es «chronyd contra una consulta HTTP a Binance»

Este es el error de encuadre que sostiene toda la propuesta de migración. La crítica compara el mejor instrumento posible en Linux, chronyd con seguimiento continuo, contra el peor instrumento posible en Windows, una única consulta HTTP a un servidor que solo devuelve un número. Con esa comparación gana Linux por goleada, evidentemente.

La comparación justa es **chronyd contra un cliente SNTP propio, en proceso, bien hecho**. Y ahí la ventaja se reduce muchísimo:

- Un cliente SNTP propio obtiene las **cuatro marcas de tiempo reales** del protocolo, no dos supuestas iguales. El tiempo de proceso del servidor sale fuera del retardo, que es exactamente lo que B2 denuncia con acierto en Binance.
- Obtiene también el estrato, la demora de raíz, la dispersión de raíz y el estado de salto, porque **todos esos campos vienen en la cabecera del propio paquete NTP**. La crítica atribuye a chronyd metadatos que en realidad los transporta el protocolo y los ve cualquier cliente que se moleste en leer la cabecera completa.
- Con varias muestras a varios servidores independientes y quedándose con la de menor retardo, se detecta un servidor que miente por intersección entre fuentes, cosa que con una sola fuente es imposible por construcción.
- No requiere permisos de administrador. Enviar a un puerto de destino 123 desde un puerto de origen efímero no exige privilegio. Esto respeta el invariante de cero elevación, que hoy `Configure-W32Time.ps1` **viola** porque exige explícitamente ejecutarse como administrador.

Lo único que chronyd tiene de verdad y que un cliente en proceso no puede dar por sí solo es una **cota sobre la tasa de deriva**, que es lo que permitiría afirmar «entre estas dos muestras, separadas 160 minutos, el reloj no pudo irse más de tanto». Y eso también se obtiene con un cliente propio si se muestrea de forma continua durante toda la corrida y se ajusta una recta a las muestras. La ventaja real de chronyd se reduce a «lo hace por ti y lo hace mejor», no a «es la única forma».

Y hay un agujero que la crítica hereda intacto y no menciona: **si el proveedor de Internet de Jean bloquea el tráfico de reloj, chronyd muere exactamente igual que un cliente SNTP en proceso**. La migración no compra inmunidad ninguna frente a ese riesgo.

### El propio punto 7 de la crítica es el más valioso, y no necesita Linux

La crítica, en su punto B8, propone «separar en la certificación tres cosas: integridad causal, rendimiento monotónico y calidad temporal UTC». **Eso es correcto, es la mejor idea de todo el expediente, y es completamente independiente del sistema operativo.**

Es más: el esqueleto ya está escrito en el código. En `audit.py:1187-1204` (verificado hoy) el auditor publica un diccionario `clock_domains` que separa las métricas en dos listas. La lista `monotonic` contiene `parse`, `book_apply`, `book_pipeline_total`, `event_loop_lag`, `writer_cooperative_yield`, `receive_to_writer_start`, `csv_write`, `csv_fsync` y `journal_build`. La lista `cross_clock` contiene únicamente `exchange_to_receive_depth`, `exchange_to_receive_trade` y `trade_time_to_receive`.

Y a continuación, en `audit.py:1205-1211` (verificado hoy), la nota dice literalmente que esas métricas de reloj cruzado deben leerse con su banda y **«NUNCA usarse como gate sin banda»**.

O sea: el código ya sabe cuáles métricas dependen del reloj de pared y cuáles no, ya lo publica, y ya declara por escrito que las primeras no valen como criterio. Lo único que falta es que el certificado deje de mezclarlas. La fusión ocurre en `audit.py:1138-1146` (verificado hoy), donde seis fuentes independientes se combinan con un «y» lógico en un único booleano por mercado.

**Separar esos tres veredictos cuesta días y no requiere cambiar de sistema operativo, ni comprar hardware, ni tocar una partición.** Poner la migración por delante de esto es invertir el orden de valor.

### La superficie de daño del reloj sobre lo que hoy se certifica es prácticamente nula

Esto lo sostiene la evidencia y hay que decirlo con todas las letras, porque es lo que quita la urgencia:

- **El libro de órdenes es ciego al reloj.** El fichero `order_book.py` no contiene ninguna referencia a tiempo: el libro se aplica exclusivamente por identificadores de secuencia. Y `reconstruct.py` agrupa y ordena por sesión, mercado, conexión e identificador local de evento, nunca por marca temporal. Ningún error de reloj, ni de 50 milisegundos ni de cinco minutos, puede corromper el libro reconstruido.
- **Ningún criterio con umbral lee el reloj de pared.** Todos los percentiles 99 y toda la temporización de etapas usan relojes monotónicos, tal y como el propio auditor declara en `audit.py:1187-1197`.
- **La restricción más estricta sobre el reloj de pared en todo el código es de 5 segundos**, no de 50 milisegundos: `launcher.py:51` fija `READY_CLOCK_FUTURE_TOLERANCE_S = 5.0` (verificado hoy) y `dual_main.py:88-94` (verificado hoy) valida el testigo de parada con una tolerancia de 5.000 millones de nanosegundos, es decir cinco segundos.

Un error de 200 milisegundos en el reloj no puede acortar ni alargar una etapa, no puede mover un percentil, no puede tumbar un control de capacidad y no puede corromper el libro. El desvío de campo real que tumbó las corridas fue de 372,904 milisegundos, y contra todo lo que hoy se certifica no habría producido ningún efecto.

### El gate mide UNA sola vez, y el `-Samples 20` es ficción

Verificado hoy sobre la versión **2.4.1**, que es la que Jean va a instalar. `launcher.py:1138` y `launcher.py:1271`
invocan el examen con los argumentos `-Samples 20 -WarnMs 50`. Ese `20` sugiere veinte observaciones. No lo es:

- `Test-ClockSync.ps1:50-51` declara y valida el parámetro `-Samples`, pero al delegar en la vía W32Time reenvía
  **únicamente** `-WarnMs`.
- `Test-W32Time.ps1:3-6` declara un bloque de parámetros que contiene **solo** `$WarnMs`. No acepta `-Samples` y
  nunca lo aceptó.

Es decir: **el veredicto de reloj de una certificación de tres horas se juega con una única lectura**, sin mediana,
sin promedio y sin descartar la muestra mala. La ironía cierra el círculo del expediente: la crítica reprocha a la
Postura A, con razón, que una sola consulta a Binance no basta para certificar 50 milisegundos. Lo que hay hoy en
producción es exactamente eso, una sola consulta, y además leída por expresión regular de un texto traducido.
Estadísticamente es el instrumento más débil posible, y cualquier sonda multi-muestra sería mejor evidencia que él.

### El gate de 50 milisegundos no certifica 50 milisegundos ni cuando pasa

Este es el hallazgo que ninguna de las dos posturas puso sobre la mesa, y es demoledor. En la evidencia real de la corrida `preflight_20260814T081121_393783Z`, el fichero `clock_preflight.json` registra que el gate **pasó** con un desplazamiento de fase de 17,478 milisegundos, mientras el **mismo informe de W32Time** declaraba una demora de raíz de 0,1299577 segundos y una dispersión de raíz de 0,0801773 segundos. La incertidumbre que la propia cadena de reloj anuncia es del orden de más menos 145 milisegundos, casi **el triple** del umbral que el gate dice imponer.

Es exactamente el mismo error categorial que la crítica denuncia con acierto en Binance: se lee un número suelto como si fuera una cota de exactitud, y no lo es. **La crítica tiene razón sobre Binance y no se dio cuenta de que su propio argumento se vuelve contra el gate que defiende.**

Hay algo peor todavía. Lo que el gate lee no es una medición independiente: es el **autoinforme de W32Time sobre su propio error**, extraído por expresión regular de la salida de `w32tm`. Umbralizar a 50 milisegundos el residuo que el propio lazo de control cree tener es interrogar al testigo preguntándole al testigo. Un lazo mal enganchado se equivoca precisamente en esa cifra.

### El único modo de error que sí hace daño es el que hoy no se mide

El desvío constante se cancela exacto en cualquier diferencia temporal. Lo que sí rompe las diferencias dentro de una corrida es un **salto** del reloj. Y el intervalo de sondeo configurado es de 2048 segundos, unos 34 minutos, de modo que durante una certificación de 160 minutos hay cuatro o cinco oportunidades de que el reloj dé un escalón en pleno vuelo.

La ironía es completa: **disciplinar el reloj inyecta justo el único modo de error que sí daña los datos, mientras suprime el único que no puede dañarlos.** Y hoy los saltos no se detectan en ningún sitio.

### El resto de exageraciones de la crítica, brevemente

- **Los siete paquetes binarios no hay que compilarlos.** Existen ya como paquetes oficiales para Linux, en las versiones exactas del fichero de bloqueo. Es descargar y volver a sellar: uno o dos días, no semanas. Esto abarata la migración y hay que reconocerlo.
- **Cuatro mecanismos críticos ya tienen rama para Linux escrita**: el bloqueo de instancia única, el arranque de procesos hijos, la comprobación de proceso vivo y la sincronización de directorio. Y la batería de pruebas no tiene ni una sola exclusión por plataforma: simula Windows en vez de exigirlo.
- **Pero hay un coste que nadie contó**: el límite de 40 milisegundos del retraso del bucle de eventos está justificado literalmente por el cuanto de Windows en `audit.py:669-696`. En Linux esa justificación se evapora y el número hay que volver a derivarlo con corridas de campo de 160 minutos antes de poder certificar nada. Ironía útil: el propio comentario admite que en Linux el límite correcto probablemente vuelve a 20 milisegundos, o sea que **la migración endurece el examen, no lo relaja**. Es un punto a favor de la crítica que la crítica no reclamó.
- **En modo normal el gate de reloj ya no bloquea.** En `launcher.py:2469-2494` (verificado hoy) el fallo del control de reloj en uso normal se convierte en un aviso, se anota en la evidencia y la captura continúa; solo la sesión queda marcada como no certificable. Únicamente en etapa certificable el gate mata. Esto reduce todavía más la urgencia.

---

## 4. La pregunta que de verdad decide

Toda la discusión ha girado en torno a «cuánto se desvía el reloj». Esa es la pregunta equivocada. La pregunta correcta es:

> **¿Cuánta exactitud de reloj de pared necesita Jean realmente, para lo que va a hacer, y quién fija ese número?**

La respuesta, tramo por tramo, con lo que se sabe hoy:

**(a) Para todo lo que la Fase 1 certifica hoy: la tolerancia al desvío es ilimitada.** Cincuenta milisegundos y doscientos milisegundos son indistinguibles para el certificado. La restricción más estricta del código es de cinco segundos (`launcher.py:51`, verificado hoy), y además el que escribe y el que lee están en la misma máquina con el mismo reloj, de modo que cualquier desvío es de modo común y se cancela exacto.

**(b) Para que la métrica `exchange_to_receive` conserve signo físico: unos 90 milisegundos del lado atrasado**, e ilimitado del lado adelantado. Ese número se deriva del percentil 50 real de esa métrica, 91,051 milisegundos. El gate de 50 milisegundos cubre eso con un margen de 1,8 veces, **por accidente**, no por diseño. Y conviene recordar que esa misma métrica tiene un percentil 95 de 2,58 segundos y un percentil 99 de 5,48 segundos: como medición ya es inservible a precisión de 50 milisegundos, porque el ruido de red la domina por dos órdenes de magnitud.

**(c) Para la Fase 2, tal y como está especificada hoy: la tolerancia al desvío también es ilimitada.** Y aquí hay que ser honesto sobre lo que no se sabe: **la unidad del horizonte de predicción no está definida en ninguna parte del proyecto**. La documentación habla de «horizonte fijo» sin decir si son eventos, milisegundos o segundos, y el propio documento de habilidades lo lista como decisión material aún pendiente. Es una dependencia inocua, porque en cualquier escenario el desvío se cancela en las diferencias y lo que manda es la **tasa de deriva**.

Y la tasa de deriva **ya está medida**, sobre los CSV reales de la corrida de campo: **8,31 partes por millón en el mercado al contado y 6,58 partes por millón en futuros**, a lo largo de 608 segundos. Exigiendo que el error del eje temporal sea menor que el uno por ciento del horizonte, harían falta menos de 10.000 partes por millón. Lo medido es 6,6 a 8,3. Hay **más de mil veces de margen incluso para un horizonte de un milisegundo**.

Además, el CSV ofrece tres ejes temporales y dos de ellos son inmunes al estado del reloj local: la marca de tiempo del propio Binance, con resolución de un milisegundo, y el reloj monotónico local. Y las características del modelo se calculan sobre el libro, que se reconstruye solo por secuencia. **Las características son independientes del reloj en cualquier escenario.**

**(d) Si algún día se cruza con una fuente externa por marca de tiempo: la tolerancia la fija esa fuente, y puede ser mucho más estricta que 50 milisegundos.** Hoy no existe ningún caso así en el proyecto: no hay otro mercado, ni noticias, ni conjunto de datos externo. El único cruce entre dos flujos es la base entre futuros y contado, y se alinea por frescura monotónica compartiendo el mismo reloj, de modo que el desvío es de modo común y se cancela. Pero si mañana entra otra plaza para estudiar quién se adelanta a quién a escala de 10 milisegundos, entonces sí haría falta exactitud absoluta por debajo de 10 milisegundos, y eso está **fuera del alcance de W32Time** por completo.

### Cómo se mide esto en vez de discutirlo

No se discute: se instrumenta. La respuesta operativa es que el sistema debe **publicar la banda de incertidumbre que ha demostrado**, no afirmar una exactitud que no puede probar. Si la banda medida sale de 23 milisegundos, está demostrada y se publica. Si sale de 65 milisegundos, se publica 65 y la corrida sigue siendo honesta: es una cifra de calidad medida, no un fallo. Lo que jamás debe ocurrir es que un número sin banda niegue un certificado que ningún criterio de certificación depende de él.

Un dato adicional que nadie había establecido y que conviene tener presente: la marca de tiempo de pared del CSV tiene resolución de 100 nanosegundos, mientras que la marca monotónica está cuantizada en múltiplos de unos 15,6 milisegundos, con el 60 por ciento de las cabeceras consecutivas compartiendo el mismo valor monotónico. Es decir, **la marca de pared es el único reloj local de alta resolución del CSV**. Si la Fase 2 necesitara alguna vez un eje temporal local por debajo de 15,6 milisegundos, tendría que usarla por fuerza. Pero la usaría en diferencias, donde el desvío se cancela.

---

## 5. Los tres planes, comparados

| Plan | Qué resuelve | Qué no resuelve | Coste real | Riesgo para Jean | Nota |
|---|---|---|---|---|---|
| **A. Reloj Testigo** — sonda SNTP en proceso, banda demostrada, corrección diferida en fichero lateral sellado | Sustituye el autoinforme de W32Time por una medición independiente con las cuatro marcas reales; da banda demostrada; sigue la deriva durante toda la corrida; detecta saltos; elimina las 2.202 líneas de PowerShell y el único punto que pide permisos de administrador | La gestión de energía de Windows, el cuanto de 15,6 milisegundos y el planificador siguen intactos. W32Time sigue disciplinando por debajo: detecta el salto, no lo impide | 4 a 5 semanas de ingeniería en tres entregas selladas, más espera de campo. Cero hardware, cero paquetes nuevos, cero cambio de sistema operativo | **Bajo.** No toca la máquina de Jean. Introduce un modo de fallo nuevo que él no puede accionar si su proveedor bloquea el tráfico de reloj | **7 / 10** |
| **B. Migración a Linux** — Ubuntu en mini‑PC dedicado, chronyd sellado, panel web como único clic | Elimina de raíz la gestión de energía por ventana en primer plano, el cuanto del temporizador y toda la clase de fallos de texto traducido. Sustrato temporal mucho más limpio. Endurece el examen de rendimiento | No implementa la corrección por fila, que es lo que de verdad mejora la auditoría. Hereda intacto el riesgo de bloqueo del tráfico de reloj. No mejora ni un microsegundo la métrica de latencia de intercambio | 9 a 12 semanas de ingeniería, unos 4 meses de calendario, 150 a 350 dólares de hardware, **más mantenimiento doble indefinido** mientras Jean siga capturando en Windows | **Medio a alto.** Cero riesgo si es mini‑PC; riesgo de perder la única máquina si alguien cede a la tentación del arranque dual. Cambia por completo la experiencia de un clic | **6 / 10** |
| **C. Tres Veredictos Primero** — separar el certificado antes de elegir sistema operativo | Ataca la causa raíz real: un solo booleano mezcla integridad de datos, rendimiento y calidad de reloj, de modo que cualquiera de los tres anula a los otros dos. Convierte «Windows o Linux» en una medición en vez de una opinión | Por sí solo no mide mejor el reloj: eso llega en su fase siguiente. No cierra la duda de cuál fue el fallo reciente de Jean | 3 a 5 días para la separación; 1 a 2 semanas para la medición del reloj. Cero red, cero hardware, cero sistema operativo | **Muy bajo.** Es el único plan que entrega valor en la primera semana y cuyo trabajo no se tira si después se migra | **6 / 10** |

### Por qué gana el que gana, en prosa

**Gana el plan C como punto de partida, con la sonda del plan A incorporada como fase siguiente, y con el plan B condicionado a una medición.** Los tres planes recibieron notas parecidas de sus revisores, y ninguno sobrevivió intacto. Pero no fallan por lo mismo, y esa diferencia es la que decide.

El plan A tiene la mejor pieza técnica del expediente: la sonda de reloj independiente con banda demostrada. Pero su criterio nuevo tal como está escrito **borra en silencio un invariante existente**, y eso es inaceptable en este proyecto. El control actual, en `launcher.py:1009-1019` (verificado hoy), no es solo el umbral de 50 milisegundos: exige además evidencia de estado válida, que la lista de servicios sea coherente, y sobre todo **que haya exactamente un disciplinador de reloj activo**. El comentario del código en `launcher.py:1004-1008` (verificado hoy) lo dice literalmente: «la invariante "doble disciplinador falla cerrado" ya no depende solo del .ps1». El plan A retira todo eso junto con el umbral, y la ironía es mortal: dos disciplinadores peleando es precisamente el generador de saltos que el plan dice querer cazar. Además no pone lista blanca a los servidores de reloj, cuando el proyecto ya tiene ese invariante para Binance, con lo que la banda pasa de ser demostrable a ser **fabricable** por cualquiera que pueda apuntar los servidores a máquinas suyas.

El plan B es el mejor documento de los tres y su diagnóstico es correcto, pero su argumento estrella es **físicamente falso**: afirma que limitar la velocidad de corrección de chrony acota el movimiento del reloj de pared respecto del monotónico, cuando en Linux ambos relojes salen del mismo temporizador y la corrección se aplica a los dos a la vez. La comparación de deriva entre plataformas que promete daría cero y no compararía nada. Además fuerza un cambio de esquema del CSV que dejaría toda la evidencia existente sin poder volver a auditarse, porque `models.py:8` fija la versión de esquema en `2.0.0` y `models.py:13` solo acepta esa (verificado hoy), con un comentario en `models.py:10-12` que documenta expresamente haber cerrado el agujero que reabrirlo supondría. Y su puerta de decisión de la primera semana depende de unos paquetes que su propio calendario entrega en la quinta.

El plan C es el que menos promete y el único cuya primera entrega **no puede salir mal**. Su fallo principal es de presentación, no de fondo: se vende con un caso de ejemplo que no aguanta la reejecución, con una prueba de aceptación que no puede fallar, y con una cita equivocada en el párrafo que dice ordenarlo todo. Todo eso se arregla reescribiendo párrafos. Lo que no hay que arreglar es su tesis, y su tesis es correcta: **el problema de Jean no es Windows ni el reloj, es que un solo booleano mezcla tres cosas que no tienen nada que ver entre sí.**

Hay una razón adicional, y es de gobierno del proyecto: el plan C entrega algo útil en la **primera semana**, y ese algo **no se tira si después se migra a Linux**. El plan B entrega su primer valor en el cuarto mes y exige mantener dos árboles, dos almacenes de paquetes y dos manifiestos mientras tanto. En un proyecto que sostiene una sola persona, para un usuario que no programa, esa asimetría decide.

---

## 6. El plan recomendado, por fases

### Fase 0 — Pedir la evidencia del fallo reciente

**Qué se entrega:** nada de código. Se le pide a Jean la carpeta `runs/` completa y el `RESULT.json` de su fallo reciente, y si no existe, se reproduce el fallo una vez y se captura.

**Qué problema resuelve:** el de B7. Hoy nadie sabe si el último fallo de Jean fue por el reloj. Todo el expediente se apoya en una corrida del 14 de agosto con un motor cuatro versiones anterior, que además falló por codificación de caracteres y no por reloj.

**Cómo se comprueba que funcionó:** existe en disco un `RESULT.json` con su estado y su código de error, y se puede decir con una cita cuál fue la causa.

**Qué decisión necesita de Jean:** ninguna decisión, solo que envíe la carpeta. Es la acción más barata del expediente y debería hacerse **antes** de escribir una sola línea de código.

---

### Fase 1 — Separar el certificado en tres veredictos

**Qué se entrega:** el fichero `RESULT.json` deja de tener un único booleano y pasa a tener tres veredictos hermanos e independientes:

- **Veredicto 1, integridad causal.** Certificación de identidad, repetición causal, integridad del diario, determinismo de la re-repetición, contadores de fallo a cero, compromiso de captura y ausencia de ficheros parciales. **Y además, de forma explícita**, que el motor terminó con código cero y que la validación del manifiesto de sesión pasó, porque hoy ambas cosas forman parte del criterio en `launcher.py:1983-1987` (verificado hoy) y omitirlas al reescribir abriría un camino de aprobación accidental. Falla en cerrado. Es ciego al desvío del reloj.
- **Veredicto 2, rendimiento monotónico.** Los umbrales de percentil 99 tal cual están hoy, más capacidad, desalojo, actividad y estado terminal. Falla en cerrado en etapa certificable. Es ciego al reloj de pared por construcción.
- **Veredicto 3, calidad temporal en tiempo universal.** Deja de ser un criterio de aprobación y pasa a ser una **clase publicada, obligatoria pero nunca mortal**.

Y un cuarto campo nuevo, `report_channel_ok`, que separa «el informe no se pudo leer» de «los datos están mal». Esa es la lección de la corrida del 14 de agosto: un error de codificación de caracteres se le presentó a Jean como si sus datos estuvieran corruptos.

**La fórmula del certificado queda escrita en la propia evidencia:** certificado igual a veredicto 1 **y** veredicto 2 **y** canal de informes correcto. El veredicto 3 se **adjunta**, nunca se multiplica.

**Qué problema resuelve:** el acoplamiento. Un reloj desviado deja de poder anular datos perfectos. Una corrida con datos íntegros, rendimiento correcto y reloj desconocido pasa a ser un resultado válido y honesto en vez de un fallo.

**Cómo se comprueba que funcionó:** con una prueba que **pueda fallar**. Se toma una copia de una corrida existente, se corrompe deliberadamente uno de sus informes, y se exige que el resultado diga `report_channel_ok` igual a falso y que el motivo publicado **no** sea un fallo de datos. Reprocesar una corrida buena y ver que sale bien no demuestra nada, porque ya sale bien hoy sin este cambio.

**Qué decisión necesita de Jean:** una decisión de gobierno, no técnica. ¿Acepta que un certificado pueda decir «datos íntegros, reloj desconocido» en vez de decir solamente «fallo»? Si la respuesta es no, este plan entero se cae.

**Coste honesto:** de 1,5 a 2,5 semanas, no los 3 a 5 días que estimaba el plan C. El motivo: el control previo ejecuta la batería completa de pruebas antes de cada captura de Jean, de modo que cualquier cambio de forma del `RESULT.json` toca pruebas que están en su camino crítico. Más el resellado del manifiesto y las baterías de paquete en frío y paquete adulterado.

---

### Fase 2 — Medir el reloj en vez de obedecerlo

**Qué se entrega:**

1. **Un cliente de reloj propio, en proceso**, que lee las cuatro marcas reales del protocolo y la cabecera completa del paquete, incluidos estrato, demora de raíz y dispersión de raíz. Cuatro servidores independientes, al menos ocho muestras por servidor, filtrado por retardo mínimo e intersección entre servidores para detectar un servidor que miente. Sin permisos de administrador.
2. **Muestreo continuo durante toda la corrida**, no una sola vez al arrancar. Esto es exactamente la objeción B4, y es lo que cierra el hueco de los 160 minutos.
3. **Un fichero lateral `clock_samples.jsonl`** dentro de la carpeta de la corrida, con una línea por paquete y todos sus campos crudos, de modo que un auditor pueda recalcular la banda desde cero. Va como `.jsonl` y fuera de las carpetas de mercado, porque el auditor y el reconstructor buscan ficheros `.csv` y se lo tragarían. El mecanismo de sellado ya admite esa extensión (`launcher.py:2032`, verificado hoy).
4. **La banda de incertidumbre publicada por corrida**, y si se quiere mayor detalle, en la fila de cabecera de cada bloque del CSV. **No se añaden columnas nuevas al CSV de eventos** y **no se reescribe la marca de tiempo de pared**: lo primero forzaría subir la versión de esquema y dejaría toda la evidencia existente sin poder volver a auditarse (`models.py:8` y `models.py:13`, verificado hoy); lo segundo sería un cambio silencioso de formato y rompería las huellas de identidad que usan ese valor como testigo.
5. **Detección de saltos con nuestros propios datos.** Esta es la mejor idea de todo el expediente y no necesita ni Linux, ni chrony, ni red, ni permisos, ni columnas nuevas: la serie de la diferencia entre la marca de pared y la marca monotónica **ya existe en cada fila de cada CSV** (`receive_time_utc_ns` menos `receive_time_monotonic_ns`, ambas tomadas en líneas consecutivas en `collector.py:627-628`). Esa diferencia es constante salvo la cuantización del reloj monotónico; cualquier discontinuidad por encima de ese ruido es un salto del reloj de pared, que es **el único modo de fallo de reloj que daña de verdad los datos**.

   **Ya está ejecutado sobre la evidencia real de Jean**, no es una propuesta teórica. Resultado sobre la corrida
   `20260814T081136_503806Z_10m_d64fea5560ac`:

   | Mercado | Filas analizadas | Rango total de la diferencia | Mayor salto entre filas consecutivas |
   |---|---|---|---|
   | contado | 418.095 | 19,325 ms | 15,922 ms |
   | futuros USDⓈ-M | 799.714 | 19,896 ms | 16,094 ms |

   Un millón doscientas mil filas y la diferencia nunca sale de una banda de 20 milisegundos, con el salto máximo
   pegado al cuanto de 15,625 milisegundos del temporizador de Windows. **El reloj de pared no dio un solo salto
   durante esa captura.** Consecuencia directa y útil: la cola de 5 segundos del percentil 99 de
   `exchange_to_receive` **no fue un salto de reloj**; es retraso real de entrega, lo que apunta a la red o a la
   degradación del proceso por Windows, que es justo lo que corrigieron las versiones 2.4.0 y 2.4.1.

   Lo notable de este detector es que **funciona hacia atrás sobre toda la evidencia ya capturada** y que su umbral
   se calibra con datos propios en vez de con una constante inventada.
6. **Conservación explícita de los invariantes estructurales del control actual.** Se retira el umbral de magnitud de 50 milisegundos, y **solo eso**. Las demás condiciones de `launcher.py:1009-1019` (verificado hoy), en particular que haya exactamente un disciplinador de reloj activo, se conservan con códigos de error propios y siguen fallando en cerrado.
7. **Lista blanca sellada de servidores de reloj**, con el mismo patrón que el proyecto ya usa para los puntos de acceso de Binance, más una bandera explícita de anulación y un campo de procedencia en la evidencia. Sin esto la banda no queda demostrada: queda **fabricable**.

**Qué problema resuelve:** sustituye el autoinforme de W32Time, que no trae banda y que en la evidencia real aprobó con 17 milisegundos mientras declaraba 145 de incertidumbre, por una medición independiente cuya banda queda demostrada por la propia medición. Y detecta el único modo de error de reloj que daña de verdad los datos.

**Cómo se comprueba que funcionó:** con un servidor de reloj falso en bucle local se comprueban la intersección, la detección de servidor mentiroso y el rechazo por falta de quórum. Y se comprueba que el fichero lateral no cae bajo ninguna búsqueda de ficheros `.csv`. Después se acumulan corridas reales con la evidencia de reloj sellada **antes de mover ningún criterio**.

**Qué decisión necesita de Jean:** aprobar una versión nueva con el manifiesto resellado, y aceptar que algunas corridas queden etiquetadas con la clase de calidad «desconocida» sin que eso sea un fallo. Es la renuncia explícita al gate de 50 milisegundos.

**Coste honesto:** de 2 a 4 semanas, en dos entregas selladas separadas para que cada una sea rechazable por su cuenta. Primero añadir la medición sin tocar el criterio; después retirar el criterio viejo.

---

### Fase 3 — Bifurcación condicionada por la medición

Solo se decide después de la medición de la sección 7. Si la medición dice que el sistema operativo no es la restricción, se cierra la versión en Windows y se documenta. Si dice que sí lo es, se compra un mini‑PC dedicado y se hace el port completo con el desglose de 9 a 12 semanas.

**Nunca arranque dual en la única máquina de Jean.** Nunca en una máquina virtual ni en el subsistema de Windows para Linux, porque el sustrato temporal seguiría siendo Windows mientras la evidencia diría «Linux», y eso es un cambio silencioso de sustrato que viola el invariante del proyecto.

Y Rust queda fuera del plan. Tres reescrituras completas del mismo producto, sobre 21.102 líneas de Python y un manifiesto sellado de más de 140 archivos que sostiene una sola persona, no es creíble. Si algún día hay Rust, debe **sustituir** a una de las dos etapas anteriores, no venir después de ambas.

---

## 7. La medición que zanja el debate Windows contra Linux

El experimento tiene que ser barato, reversible y con la regla de decisión **firmada antes de ver los números**. Sin ese compromiso previo, la medición se racionaliza a posteriori y no decide nada.

### Preparación, uno o dos días

Descargar los siete paquetes binarios para Linux, que ya existen en las versiones exactas del fichero de bloqueo, volver a calcular sus huellas contra una segunda fuente y resellar. Sin esto no hay producto que ejecutar en Linux, y ejecutar otra cosa mediría otro binario.

### El experimento, unas cuatro horas de máquina

Se arranca la laptop de Jean desde una memoria USB con Linux **en modo prueba**, sin instalar nada y sin tocar ninguna partición. Se corre el motor, no el lanzador completo, porque el mandato de auditoría de métricas es autónomo sobre el fichero de métricas y el motor ya tiene rama para Linux escrita. Eso evita tener que portar las 767 líneas del lanzador atadas a Windows solo para hacer una medición.

Seis corridas de diez minutos en cada sistema, **intercaladas**, en la misma máquina, la misma red y las mismas franjas horarias.

### Qué se mide

- El percentil 99 del retraso del bucle de eventos.
- El percentil 99 de la aplicación del libro y del canal completo del libro. **Esta métrica es imprescindible y el plan C la omitía**: en la única corrida real que existe, la que falló, esa métrica dio 15 y 16 milisegundos contra un límite de 5, mientras el retraso del bucle daba 23 contra un límite de 40. Es decir, la métrica que de verdad suspendió no estaba en la regla de decisión.
- El máximo de cesión cooperativa del escritor.
- Si el tráfico de reloj sale de la red de Jean, y cuál es el retardo mínimo a los servidores.
- La resolución real de las funciones de tiempo en su máquina.

### La regla de decisión, firmada antes de medir

**Migrar** si, y solo si, en Windows alguna métrica de rendimiento monotónico supera su límite en al menos dos de las seis corridas, **y** la mediana de las seis corridas en Linux queda cómodamente por debajo del límite más estricto.

**No migrar** si Windows pasa las seis de seis con margen. En ese caso el sistema operativo no es la restricción y las nueve a doce semanas no compran nada.

**Inconcluso** en cualquier otro caso, y entonces se repite con la etapa de treinta minutos, que tiene muchas más muestras.

**Anulador previamente registrado, y es importante:** si el proveedor de Internet de Jean bloquea el tráfico de reloj, **chronyd muere exactamente igual** que un cliente en proceso. En ese caso la pata del reloj **no puede** justificar la migración y queda excluida de la decisión por completo.

**Advertencia sobre la validez del dato:** la corrida de referencia que existe es de un motor de la versión 2.3.4, y en la 2.3.6 cambió la fuente de temporización de duraciones. Es muy probable que aquellos 15 y 16 milisegundos fueran cuantización ya corregida. Por eso la regla debe definirse contra la versión 2.4.1 y no contra datos viejos, y por eso conviene correr el auditor de métricas sobre una captura de diez minutos con la versión actual **antes** de firmar nada. Si esa métrica ya baja del límite, el bloqueo real de Jean no es ni el reloj ni el canal de informes, y el orden de las fases habría que revisarlo.

### Riesgo

Cero. No se toca ninguna partición, no hay cifrado de disco que redimensionar, no se instala nada. Si algo va mal, se apaga y se retira la memoria USB. La memoria USB sirve como **experimento** y jamás para certificar: el sistema de persistencia sobre una memoria extraíble añade latencia de entrada y salida propia que penalizaría a Linux injustamente, y la carpeta de evidencia es intocable y una memoria extraíble es mal sitio para ella.

---

## 8. Lo que NO se debe hacer

**No bajar el umbral de 50 milisegundos a un número más cómodo.** Sería exactamente el cambio silencioso de umbral que el proyecto prohíbe, y además no arregla nada: el problema no es que el número sea 50, es que ese número no mide lo que dice medir y no protege nada que el certificado lea.

**No fabricar nunca un PASS.** Si la banda no se puede demostrar, la clase de calidad se publica como «desconocida» y el certificado sigue siendo válido en integridad causal y en rendimiento. Lo que jamás debe ocurrir es que se invente un valor por omisión, se rellene un campo ausente con un supuesto, o se apruebe un criterio porque su instrumento no respondió. Se falla en cerrado en el **certificado de calidad de reloj**, nunca en la **captura**.

**No retirar el resto de condiciones del control actual junto con el umbral.** El control de `launcher.py:1009-1019` (verificado hoy) exige seis cosas más, entre ellas que haya exactamente un disciplinador de reloj activo. Retirar eso al retirar el umbral sería borrar un invariante en silencio, y precisamente el invariante que protege contra el generador de saltos.

**No añadir columnas al CSV de eventos en esta versión.** Forzaría subir la versión de esquema, y como `models.py:13` (verificado hoy) solo acepta la versión actual, toda la evidencia ya guardada dejaría de poder volver a auditarse. La alternativa de aceptar dos versiones reabriría el agujero que `models.py:10-12` documenta haber cerrado. La banda va en un fichero lateral y, si acaso, en la fila de cabecera.

**No reescribir jamás la marca de tiempo de pared para «corregirla».** Sería un cambio silencioso de semántica del dato y rompería las huellas de identidad que usan ese valor como testigo. Se añade incertidumbre; no se altera el dato.

**No hacer arranque dual en la única laptop de Jean.** El cifrado de disco viene activado de fábrica en Windows 11: redimensionar una partición cifrada sin la clave de recuperación puede significar perder los datos. Y si algo falla, Jean necesitaría una segunda máquina para arreglarlo, y no la tiene.

**No usar el subsistema de Windows para Linux ni una máquina virtual.** En ambos casos el reloj lo sincroniza el anfitrión y el planificador que hay por debajo sigue siendo el de Windows. La evidencia diría «Linux» mientras el sustrato sería Windows. Es un cambio silencioso de sustrato.

**No sacar el panel de control a la red local en esta versión.** Hoy `dashboard.py:642-643` (verificado hoy) rechaza por construcción cualquier enlace que no sea de bucle local, con el mensaje «El dashboard solo puede enlazarse a una IP loopback», y hay una prueba que lo fija. Convertir un panel de solo lectura en un plano de control que arranca corridas y sirve ficheros es rediseñar un componente sellado, no «extender una lista».

**No dejar los ficheros de un clic fuera del perímetro sellado.** La regla de construcción del paquete impone que solo haya un fichero ejecutable de un clic dentro del árbol sellado. **Verificado:** en la versión 2.4.1 hay cuatro sueltos por fuera (`ARREGLAR_RELOJ.cmd`, `CERTIFICAR_BTCUSDT.cmd`, `INSTALAR_EN_C_v241.cmd`, `RECOGER_EVIDENCIA_TODO.cmd`, sellados aparte en `entregables/SELLOS.sha256`), de modo que **cuatro de las cinco cosas que Jean pulsa dos veces viven fuera del perímetro sellado**. Eso contradice el invariante de un solo ejecutable de un clic más que toda la discusión sobre el sistema operativo, y es además la causa más directa de su queja literal de «muchas configuraciones». Consolidarlos en un único punto de entrada dentro del manifiesto es trabajo de días y no depende de ninguna decisión sobre el reloj.

**No escribir una línea de Rust.** Ni ahora ni como plan futuro comprometido.

---

## 9. Lo que necesito que Jean decida ahora

Una sola pregunta, y de ella depende todo lo demás:

> ### ¿Acepta usted que un certificado pueda decir «datos íntegros, rendimiento correcto, calidad de reloj desconocida» y siga siendo un certificado válido?
>
> Hoy su producto tiene un único sello: aprueba o no aprueba. Si el reloj no llega a 50 milisegundos, se le niega el certificado aunque los datos estén perfectos, aunque el libro se haya reconstruido sin un solo hueco y aunque todos los tiempos de respuesta estén dentro de límite. Se le propone partir ese sello en tres: uno para la integridad de los datos, otro para el rendimiento, y un tercero que **informa** de la calidad del reloj sin poder negar nada.
>
> **Si dice que sí**, se ejecutan las fases 1 y 2 sobre Windows, cuestan entre cuatro y seis semanas, no hay que comprar nada, no hay que tocar su laptop, y la decisión sobre Linux queda pendiente de una medición de cuatro horas y riesgo cero.
>
> **Si dice que no**, y quiere que el certificado siga siendo un único sí o no, entonces este arbitraje no aplica y hay que volver a discutir cuál debe ser el criterio único. En ese caso conviene saberlo antes de escribir una sola línea.

Y una petición que no es una decisión y que le pido igualmente: **envíe la carpeta `runs/` y el `RESULT.json` de su último fallo**. Es lo más barato de todo este expediente y es lo único que puede confirmar, o desmentir, que el problema fuera el reloj.

---

## Anexo — Incertidumbres que declaro en vez de rellenar

1. ~~Todas las líneas citadas son de la versión 2.3.9 y hay que renumerar.~~ **RESUELTO.** Se extrajo y comparó el ZIP sellado de la 2.4.1: los siete módulos de datos y los tres scripts de reloj son byte a byte idénticos, y el diff de `launcher.py` no toca ninguna línea de reloj. La única renumeración necesaria es `launcher.py:2541` → `2634`, ya aplicada en la sección 2. No hacen falta los uno o dos días presupuestados.
2. **No pude ejecutar la batería de pruebas.** En este entorno hay Python 3.11 y el proyecto exige 3.12, sin dependencias instaladas. Las afirmaciones sobre portabilidad son predicción fundada en la lectura del código, no una ejecución en verde.
3. **No sé si el router de Jean intercepta o reescribe el tráfico de reloj** con un intermediario transparente. Es detectable parcialmente por síntomas, no con certeza.
4. **No sé si su proveedor de Internet permite el tráfico de reloj.** La evidencia de su propia corrida sugiere que sí, porque el informe de W32Time registra un estrato 2 y un servidor del conjunto público que le respondió. Pero no es lo mismo que medirlo, y hay que medirlo.
5. **No he verificado en su máquina la resolución de las funciones de tiempo de Python.** La medición sobre sus CSV reales, con un máximo común divisor de exactamente 100 nanosegundos, lo respalda con fuerza, pero se toma en su proceso, no en el mío.
6. ~~Que los cuatro ficheros de un clic de la 2.4.1 estén fuera del manifiesto es inferencia mía.~~ **CONFIRMADO, ya no es inferencia.** En `entregables/` conviven `ARREGLAR_RELOJ.cmd`, `CERTIFICAR_BTCUSDT.cmd`, `INSTALAR_EN_C_v241.cmd` y `RECOGER_EVIDENCIA_TODO.cmd`, sellados aparte en `entregables/SELLOS.sha256`, mientras el manifiesto del ZIP declara 144 archivos e incluye `INICIAR.cmd` como único ejecutable de un clic dentro del perímetro. Son, por tanto, **cinco puntos de entrada y cuatro viven fuera del árbol sellado**, cada uno con su propio PowerShell incrustado y su propia lógica para elegir entre las instalaciones del disco.
7. **Los precios de hardware son de mercado**, no verificados hoy.
8. **Las cifras de rendimiento típico de chronyd** son conocimiento general de ingeniería, no están verificadas contra ningún documento de este árbol ni contra ninguna instalación real.

---

*Fin del informe. Ninguna afirmación de este documento sobre el código carece de archivo y línea, y las que no pude verificar están marcadas como incertidumbre.*
