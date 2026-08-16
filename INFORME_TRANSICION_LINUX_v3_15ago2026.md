# INFORME — Plan de transición y validación hacia Linux

**Versión 3, corregida.** Sustituye a la versión 2, que queda como evidencia histórica junto con
`INFORME_ARBITRAJE_RELOJ_15ago2026.md`.
**Fecha:** 15 de agosto de 2026.
**Alcance:** documento de análisis y plan. **No se ha modificado ni una línea de código, ni un certificado, ni un
esquema, ni un instalador, ni ningún archivo del motor.**

**Lo único que este informe pide autorizar:** localizar y recoger la sesión exacta que realmente falló, sin
sobrescribir ni instalar nada. **No** se pide instalar la versión 2.4.1. **No** se pide portar el motor. **No** se
pide ejecutar pruebas en Linux.

---

## 0. Cómo leer este informe

| Etiqueta | Qué significa |
|---|---|
| **[HECHO COMPROBADO]** | Se abrió el archivo y se leyó, o se ejecutó la medición. Lleva archivo y línea, o el número medido. |
| **[ESTIMACIÓN]** | Número o juicio derivado de datos reales mediante un razonamiento declarado. El razonamiento se puede discutir. |
| **[HIPÓTESIS]** | Explicación plausible **no demostrada**. Se marca para poder refutarla, no para apoyarse en ella. |
| **[DECISIÓN DEL PROYECTO]** | Elección de Jean o regla del protocolo. No se discute técnicamente: se cumple. |
| **[RIESGO PENDIENTE]** | Hueco identificado que **no se corrige ahora** y que queda registrado para decidir después. |

### Nomenclatura de fases, para que no se confundan dos cosas distintas

**[DECISIÓN DEL PROYECTO]** A partir de esta versión se usan prefijos obligatorios:

- **`ML-F1`, `ML-F2`, `ML-F3`** son las fases del producto: captura (existe), aprendizaje automático con order flow y
  LightGBM (bloqueada), inferencia en vivo (futura).
- **`TRANSICIÓN-T0` … `TRANSICIÓN-T5`** son las etapas de la migración a Linux.

En las versiones anteriores ambas se llamaban «Fase 2» y eso era una fuente real de confusión. **`TRANSICIÓN-T2` no
tiene ninguna relación con `ML-F2`.**

---

## 1. Estado de la decisión y de la autorización

**[DECISIÓN DEL PROYECTO]** Dejar de depender de Windows es dirección estratégica **ya tomada**. Destino: **Linux
nativo, manteniendo Python**, con **chronyd** como disciplinador y **systemd** para arrancar y supervisar.

**[DECISIÓN DEL PROYECTO]** No se usan WSL2 ni Docker sobre Windows como solución definitiva. No se reescribe en Rust
ni en Go salvo que mediciones futuras demuestren necesidad real.

**[DECISIÓN DEL PROYECTO]** Esa dirección **no autoriza la migración** ni da su resultado por aprobado.

**[DECISIÓN DEL PROYECTO]** Autorización vigente hoy, y nada más: **localizar y recoger la sesión exacta que
realmente falló, sin sobrescribir ni instalar nada.**

**[DECISIÓN DEL PROYECTO]** Explícitamente **no autorizado** todavía: instalar la 2.4.1, modificar código, portar el
motor, ejecutar pruebas en Linux.

**[DECISIÓN DEL PROYECTO]** Si Linux falla una prueba, no se oculta ni se acomodan los criterios. Se abre un bloqueo
(sección 9) y se clasifica.

**[DECISIÓN DEL PROYECTO]** Se aceptan los tres veredictos separados: integridad causal, rendimiento monotónico y
calidad temporal UTC. `RESULT.pass` y `CAPTURA_COMPLETA_AUDITADA.json` se conservan intactos.

---

## 2. Correcciones aplicadas en esta versión 3

Se listan primero porque tres de ellas cambian conclusiones que la versión 2 daba por buenas.

| Punto | Estado en v2 | Corrección en v3 |
|---|---|---|
| Causa del fallo de la sesión 2.3.4 | Se atribuía a la **θ** y al `UnicodeEncodeError` de cp1252 | **Incompleto y por tanto engañoso.** Hubo **dos** fallos de codificación distintos. Sección 4.1. |
| Segmentos desordenados «fallan cerrado» | Se afirmaba como hecho, apoyado en K1 | **Retirada.** K1 no demuestra orden. Pasa a `[RIESGO PENDIENTE]`. Sección 3.3. |
| `RECOGER_EVIDENCIA_TODO.cmd` «junta la carpeta runs completa» | Se afirmaba como hecho | **Falso.** Recoge **solo la corrida más reciente** de cada instalación. Sección 4.3. |
| Orden de la transición | Capturas en Linux antes de adaptar el motor | **Era circular.** Nuevo orden T0…T5. Sección 8. |
| Comparación del replay | «SHA-256 idénticos byte a byte» de los informes | **Inaplicable:** los informes contienen rutas distintas. Se compara estado canónico. Sección 8.3. |
| Manifiesto | «los mismos sellos» para todo el árbol | **Imposible por construcción.** Manifiesto común del núcleo más manifiestos por plataforma. Sección 8.3. |
| Batería de pruebas | «mismo número de pruebas superadas» | **Insuficiente.** Mismos identificadores y resultados. Sección 8.3. |
| Aritmética de las capturas | «unas 9 horas por plataforma» | **Mal calculada.** Son **16 h por plataforma y 32 h entre ambas**. Sección 8.5. |
| Criterio de aprobación | «5 de 6 por métrica» | **Peligroso:** podía aprobar sin ninguna corrida sana. Ahora el criterio es **por corrida completa**. Sección 8.5. |
| Contrato de chronyd y systemd | No existía | Definido en la sección 7. |
| Criterio UTC | `|θ̂| + δ/2 ≤ L` con δ de la sonda HTTP | Reformulado como `|offset| + incertidumbre certificable ≤ L`, con la incertidumbre **propia de cada fuente**. Sección 6.3. |
| `INTEGRIDAD_CAUSAL.json` | Idea sin especificar | Especificado con esquema, política, estados y escritura atómica. Sección 6.2. |
| Live USB / mini-PC | «comparación limpia» / «riesgo cero» | **Ambas retiradas.** La ubicación se decide tras el inventario de compatibilidad. Sección 8.6. |
| Nombres de fases | «Fase 2» significaba dos cosas | Separadas en `ML-F2` y `TRANSICIÓN-T2`. Sección 0. |

---

## 3. Base de hechos: qué depende del reloj y qué no

### 3.1 Dominios de reloj

**[HECHO COMPROBADO]** `audit.py:1187-1204` publica `clock_domains`. En `monotonic`: `parse`, `book_apply`,
`book_pipeline_total`, `event_loop_lag`, `writer_cooperative_yield`, `receive_to_writer_start`, `csv_write`,
`csv_fsync`, `journal_build`. En `cross_clock`, solo: `exchange_to_receive_depth`, `exchange_to_receive_trade`,
`trade_time_to_receive`.

**[HECHO COMPROBADO]** `audit.py:1205-1211` dice literalmente que las métricas de reloj cruzado deben leerse con su
banda y **«NUNCA usarse como gate sin banda»**.

**[HECHO COMPROBADO]** Los cinco criterios con umbral (`audit.py:935-966`) evalúan métricas monotónicas.

**[HECHO COMPROBADO]** La restricción más estricta sobre el reloj de pared en el código es de **cinco segundos**:
`launcher.py:51` (`READY_CLOCK_FUTURE_TOLERANCE_S = 5.0`) y `dual_main.py:88-94`.

### 3.2 Dónde sí entra el reloj de pared

**[HECHO COMPROBADO]** `main.py:23-25` fecha cada línea del registro con `datetime.fromtimestamp(record.created)`,
que procede del reloj de pared, y la exclusión de calentamiento de la 2.3.9 selecciona qué ventanas cuentan usando
esas marcas.

**[HECHO COMPROBADO]** `writer.py:224-225` nombra cada segmento `events-<marca UTC>-<número:06d>.csv`, y
`reconstruct.py:481` los ordena con un `sorted()` alfabético, de modo que la marca de fecha domina sobre el contador
de segmento.

### 3.3 RIESGO PENDIENTE: el orden de los segmentos no está garantizado

La versión 2 afirmaba que un segmento fuera de orden «falla cerrado» gracias a K1. **Esa garantía se retira.**

**[HECHO COMPROBADO]** K1 (`reconstruct.py:286-297`) detecta únicamente **conflictos de unicidad**: que un mismo
`ingest_seq` referencie dos huellas de payload distintas. Si los segmentos se leen en orden incorrecto, cada
`ingest_seq` sigue siendo único con su propia huella, de modo que **K1 permanece en silencio**.

**[HECHO COMPROBADO]** El estado del replay solo acumula `ingest_seq_min` con `min()` y `ingest_seq_max` con `max()`
(`reconstruct.py:260-268`). Ambas son **independientes del orden** por definición. **No existe en `reconstruct.py`
ninguna comparación contra un valor previo que exija `ingest_seq` creciente.**

**[HIPÓTESIS]** La comprobación de contigüidad de secuencia del libro (contado exige `U <= último+1`) probablemente
detectaría un desorden de segmentos y produciría un `ReplayError`. **No está demostrado** y no se ha construido el
caso de prueba que lo demuestre.

**[RIESGO PENDIENTE 1]** Un movimiento del reloj de pared hacia atrás durante la captura podría producir nombres de
segmento que ordenen mal, y **no está establecido** que el replay lo detecte en todos los casos.
**No se corrige código ahora.** Queda registrado para decidir después de T0. La comprobación que lo cerraría es un
caso de prueba con segmentos deliberadamente renombrados fuera de orden.

### 3.4 Qué hace hoy el gate de reloj

**[HECHO COMPROBADO]** El gate **toma una sola observación**. `launcher.py:1138` y `:1271` lo invocan con
`-Samples 20 -WarnMs 50`; `Test-ClockSync.ps1:50-51` reenvía **solo** `-WarnMs`; el bloque de parámetros de
`Test-W32Time.ps1:3-6` declara **solo** `$WarnMs`. El `20` se descarta en silencio. Igual en la 2.4.1.

**[HECHO COMPROBADO]** En campo el gate **aprobó con 17,478 ms**
(`runs/preflight_20260814T081121_393783Z/clock_preflight.json`, `pass: true`, `error_code: "PASS"`).

**[HECHO COMPROBADO]** El **mismo informe** de W32Time declaraba demora de raíz 0,1299577 s y dispersión de raíz
0,0801773 s.

**[ESTIMACIÓN]** La incertidumbre que esa misma cadena anuncia es del orden de **±145 ms**.

**Enunciado correcto:** ese offset aislado de 17,5 ms **no certifica exactitud UTC absoluta de ±50 ms**. No afirma
que el reloj estuviera mal; afirma que ese número, solo, no sostiene la conclusión que el gate extrae de él. Es el
residuo que un lazo de control cree tener, no una cota de exactitud.

**[HECHO COMPROBADO]** El gate se aplica dos veces (`launcher.py:1136` y `:1267`). En etapa certificable, el fallo
del segundo pone `pass = False` y `status = "CLOCK_POSTFLIGHT_FAILED"` (`launcher.py:2634` en la 2.4.1), **sin borrar
datos**: escribe `evidence_hashes` y guarda `RESULT.json`.

### 3.5 El estimador contra Binance

**[HECHO COMPROBADO]** `rest.py:217-267` usa la fórmula de cuatro marcas, pero su propio comentario dice
`T2 = T3 = serverTime` y `rest.py:264` calcula el retardo como `t4_ns - t1_ns`, el viaje completo.

**[HECHO COMPROBADO]** Se consulta **una vez por mercado al arrancar** (`collector.py:335` desde `_startup_gates`,
invocado una vez en `collector.py:196`), y `collector.py:344-345` lo declara «evidencia, no un gate».

**[HECHO COMPROBADO]** Medido en campo: θ̂ = +47,8 ms con δ = 277 ms en contado; θ̂ = +49,0 ms con δ = 276,5 ms en
futuros. W32Time decía +17,5 ms en el mismo periodo: **discrepan unos 30 ms**.

**[ESTIMACIÓN]** Con δ = 277 ms la banda es ±138 ms, y su suelo es estructural (la mitad del viaje mínimo). Contra un
endpoint HTTPS desde Perú ese método **no puede** resolver a la escala de 50 ms, ni con muchas muestras.

### 3.6 El detector de saltos: qué mide y qué no

**[HECHO COMPROBADO]** Cada fila lleva `receive_time_utc_ns` y `receive_time_monotonic_ns`, tomadas en líneas
consecutivas (`collector.py:627-628`). Su diferencia es constante salvo la cuantización del monotónico.

**[HECHO COMPROBADO]** Ejecutado sobre `20260814T081136_503806Z_10m_d64fea5560ac`: contado 418.095 filas, rango
19,325 ms, mayor salto entre filas 15,922 ms; futuros 799.714 filas, rango 19,896 ms, mayor salto 16,094 ms.

**Enunciado correcto:** **no detectó discontinuidades por encima de su umbral de resolución**, que en esa corrida fue
de unos 20 ms. **No demuestra que el reloj no diera ningún salto.** Límites: **[HECHO COMPROBADO]** su resolución
está acotada por el cuanto de unos 15,6 ms del monotónico de Windows; solo observa instantes con fila escrita; solo
cubre la ventana capturada, no el preflight ni el postflight.

### 3.7 W32Time y los saltos

**[HECHO COMPROBADO]** El perfil público usa sondeo de 2048 s (`Configure-W32Time.ps1`, perfil `PublicInternet`), y
`README_NTP_WINDOWS.md:18` prohíbe cualquier `resync` durante la captura.

**[ESTIMACIÓN]** W32Time corrige normalmente **deslizando**, y escalona solo por encima de su umbral de escalón.
**[HIPÓTESIS]** Si alguna ocasión de sondeo produjera un escalón, sería el modo dañino. No hay evidencia de que
ocurriera.

### 3.8 La superficie que se abandona

**[HECHO COMPROBADO]** 2.202 líneas de PowerShell en diez ficheros, 63 expresiones regulares sobre la salida
**traducida** de `w32tm.exe`, 24 códigos de error. `TimeSync-Common.ps1:247` busca «Phase Offset», «Desplazamiento de
fase» o «Desfase»; existe `STATUS_LOCALE_UNSUPPORTED` para idiomas no previstos.

**[HECHO COMPROBADO]** El almacén de ruedas tiene 20 paquetes: **7 son `cp312-win_amd64`** (aiohttp, frozenlist,
multidict, orjson, propcache, websockets, yarl) y 13 son puros.

**[HECHO COMPROBADO]** Cinco puntos de entrada de doble clic, cuatro **fuera** del paquete sellado
(`ARREGLAR_RELOJ.cmd`, `CERTIFICAR_BTCUSDT.cmd`, `INSTALAR_EN_C_v241.cmd`, `RECOGER_EVIDENCIA_TODO.cmd`, sellados en
`entregables/SELLOS.sha256`). Solo `INICIAR.cmd` está dentro del manifiesto de 144 archivos.

---

## 4. La evidencia disponible, y lo que de verdad dice

### 4.1 CORRECCIÓN: la sesión 2.3.4 no cayó solo por la θ

La versión 2 atribuía la caída al `UnicodeEncodeError` de cp1252 y a la **θ**. **Era una verdad parcial y por tanto
engañosa.** En el `RESULT.json` de la sesión `d64fea5560ac` hay **dos fallos de codificación distintos, en
direcciones opuestas y en sitios distintos**:

**[HECHO COMPROBADO]** Fallo A, de **escritura**: `audit_metrics.json` no contiene un informe sino un rastro de
excepción con `UnicodeEncodeError: 'charmap' codec can't encode characters in position 538-539`, producido en
`audit.py:1180` al imprimir el resultado.

**[HECHO COMPROBADO]** Reproduciendo esa salida, el primer carácter que cp1252 no sabe escribir es la **θ** de la
nota del reloj.

**[HECHO COMPROBADO]** Fallo B, de **lectura**, y este es el que la versión 2 omitió. Dentro del propio
`RESULT.json`:

```
.audit.replay_determinism.spot.error
  RuntimeContractError: 'utf-8' codec can't decode byte 0xe9 in position 700: invalid continuation byte

.audit.replay_determinism.usdm_futures.error
  RuntimeContractError: 'utf-8' codec can't decode byte 0xe9 in position 767: invalid continuation byte
```

**[HECHO COMPROBADO]** Son `UnicodeDecodeError` de UTF-8, no de cp1252, en las **posiciones 700 y 767**, en los
replays de contado y de futuros. El byte `0xE9` es la «é» en cp1252.

**[HECHO COMPROBADO]** Estas dos posiciones, 700 y 767, coinciden exactamente con las que la propia historia del
proyecto registra para las dos certificaciones vetadas de la 2.3.4.

**Conclusión correcta:** aquella sesión cayó por **al menos dos manifestaciones distintas del mismo defecto de
transporte de texto** en Windows en español: una al escribir el informe de métricas y otra al leer los informes de
replay. Atribuirlo todo a la θ era incorrecto. **[HECHO COMPROBADO]** El estado global fue `DATA_GATES_FAILED` y el
reloj de esa sesión **pasó** (17,478 ms).

### 4.2 Lo que sigue sin estar probado

**[HECHO COMPROBADO]** El único `RESULT.json` disponible es el de la sesión `d64fea5560ac`, de la versión **2.3.4**,
y sus claves de nivel superior **no incluyen** `clock_preflight` ni `clock_postflight`.

**Conclusión, sin adornos:** **los archivos entregados hasta hoy no demuestran ningún fallo de reloj en la versión
2.3.9 ni posterior.** Toda la discusión sobre el reloj se apoya en un informe de campo escrito.

### 4.3 CORRECCIÓN: cómo recoger la sesión correcta, y cómo comprobar que se recogió

La versión 2 afirmaba que `RECOGER_EVIDENCIA_TODO.cmd` «junta la carpeta `runs\` completa». **Es falso.**

**[HECHO COMPROBADO]** El script localiza todas las carpetas `runs` bajo `C:\JF` (líneas 75-76), y para cada
instalación ordena las corridas por nombre y toma **únicamente la última**:

```
$mains = @($hijos | Where-Object { $_.Name -match '^[0-9]{8}T[0-9]' } | Sort-Object Name)
$run = $mains[$mains.Count - 1]
```

**[HECHO COMPROBADO]** Con los preflight hace lo mismo: toma `$pfs[$pfs.Count - 1]`, el más reciente de esa
instalación.

**Dos consecuencias que hay que tener presentes:**

1. **Si Jean ejecutó cualquier cosa después del fallo**, aunque fuera un arranque abortado, la corrida fallida **no
   entra en el zip**.
2. **[ESTIMACIÓN]** El preflight que empareja es el más reciente de la instalación, que **no tiene por qué ser el
   preflight de la corrida recogida**. Es contexto, no necesariamente el par correcto.

**Cómo comprobar que se recogió la sesión correcta.** **[HECHO COMPROBADO]** El script escribe dentro del zip un
`LISTADO_COMPLETO.txt` con una sección `RESUMEN DE INSTALACIONES` que declara, por cada instalación, qué corrida
eligió:

```
<etiqueta>: run 20260814T081136_503806Z_10m_d64fea5560ac  (C:\JF\...)
```

**Procedimiento de verificación, sin instalar ni sobrescribir nada:**

1. Abrir el zip y leer `LISTADO_COMPLETO.txt`.
2. Comprobar que la marca de fecha y hora del nombre de la corrida listada **coincide con el momento del fallo**.
3. Comprobar que dentro de esa carpeta existe `RESULT.json` y que su campo `status` es el del fallo.
4. Si la corrida listada **no** es la del fallo, no ejecutar nada más: **copiar a mano** la carpeta de la corrida
   fallida y su `preflight_*` correspondiente, comprimirlas y subirlas. **[DECISIÓN DEL PROYECTO]** Copiar es una
   operación de lectura sobre `runs\`; no modifica, no renombra y no borra, de modo que respeta la regla de evidencia
   intacta.

**[DECISIÓN DEL PROYECTO]** **No se crea ningún `.cmd` nuevo** para esto. Si el script existente no acierta, se
copia a mano.

### 4.4 Qué se pide exactamente

De **la sesión que realmente falló**, la reciente:

1. `RESULT.json`
2. `clock_preflight.json` — está en `runs\preflight_<marca>\`, y hay que tomar **el preflight cuya marca sea la
   inmediatamente anterior al inicio de esa corrida**, no simplemente el último.
3. `clock_postflight.json` — en la carpeta de la corrida.
4. `jean_flow_metrics.jsonl`
5. Los `audit_*.json` de `capture\`
6. `LISTADO_COMPLETO.txt` del propio zip, para poder comprobar qué se eligió.

---

## 5. chronyd frente a un cliente propio

**[HECHO COMPROBADO]** Un cliente SNTP propio obtiene del paquete las cuatro marcas reales y la cabecera completa,
incluidos estrato, demora de raíz, dispersión de raíz e indicador de salto. Esos campos viajan en el protocolo.

**Lo que un cliente propio NO da y chronyd sí:** **[ESTIMACIÓN]** un lazo de control con fichero de deriva
persistente que aprende la tasa del oscilador entre arranques; disciplina real del reloj del sistema, no solo
medición; algoritmos de selección de fuente y detección de falsos tickers endurecidos durante años; y exposición de
su propio estado de calidad en forma legible por máquina y **no localizada**.

**Conclusión:** un cliente propio es un **instrumento de medida**; chronyd es un **lazo de control con
instrumentación incluida**. La versión 2 los presentó como casi equivalentes y eso fue un error. Para el objetivo
declarado, **chronyd es la elección correcta**.

**[HIPÓTESIS]** El riesgo que chronyd **no** elimina es que la red de Jean bloquee el tráfico de reloj. Se mide en
`TRANSICIÓN-T3`, no se supone.

---

## 6. Los tres veredictos, especificados

### 6.1 Lo que no se toca

**[HECHO COMPROBADO]** Hoy el veredicto es un booleano por mercado construido en `audit.py:1138-1146` con seis
fuentes combinadas por «y» lógico, y `RESULT.pass` recoge el resultado global.

**[DECISIÓN DEL PROYECTO]** `RESULT.pass` y `CAPTURA_COMPLETA_AUDITADA.json` conservan **exactamente** su significado,
su criterio y su condición de emisión actuales. No se reutilizan, no se redefinen, no se relajan. Un consumidor
existente no debe notar ninguna diferencia.

### 6.2 Especificación del nuevo resultado causal

**[DECISIÓN DEL PROYECTO]** Se propone **un solo artefacto nuevo**, adicional y nunca sustitutivo. Nombre propuesto:
`RESULTADO_CAUSAL.json`, junto al `RESULT.json` de la corrida. Se descarta el nombre `INTEGRIDAD_CAUSAL.json` de la
versión 2 porque el archivo contiene **tres** veredictos y no solo la integridad, y ese nombre mezclaba conceptos.

**Especificación propuesta, para revisión. No se implementa nada todavía.**

| Campo | Tipo | Definición |
|---|---|---|
| `schema_version` | texto | Versión propia del artefacto, independiente del esquema 2.0.0 del CSV. Empieza en `1.0.0`. |
| `policy` | texto | Identificador de la política de evaluación aplicada, versionado. Cambiar el criterio obliga a cambiar este valor. |
| `capture_session_id` | texto | Identidad de la corrida, copiada del `RESULT.json`, no recalculada. |
| `causal_integrity` | `PASS` \| `FAIL` | Nunca `UNKNOWN`: o se pudo evaluar o el artefacto no se emite. |
| `monotonic_performance` | `PASS` \| `FAIL` \| `UNKNOWN` | `UNKNOWN` solo si faltan muestras suficientes, con el motivo declarado. |
| `utc_quality` | `PASS` \| `FAIL` \| `UNKNOWN` | En esta entrega **nunca puede negar nada**. `UNKNOWN` es un resultado legítimo. |
| `utc_quality_reason` | texto | Motivo obligatorio cuando no es `PASS`. |
| `inputs_sha256` | objeto | Hash de cada archivo de entrada leído para emitir este veredicto. |
| `result_json_sha256` | texto | Hash del `RESULT.json` de la misma corrida, para atar ambos artefactos. |
| `emitted_utc_ns` | entero | Momento de emisión. |
| `engine_version` | texto | Versión del motor que produjo la corrida. |

**Condición exacta de emisión.** **[DECISIÓN DEL PROYECTO]** El artefacto se emite **si y solo si** existe un
`RESULT.json` completo para esa corrida y se pudieron leer todos los archivos de `inputs_sha256`. Si falta alguno,
**no se emite el archivo**; no se emite con campos vacíos ni con valores por defecto. Un artefacto ausente es un
resultado honesto; un artefacto incompleto es una trampa.

**Escritura atómica.** **[DECISIÓN DEL PROYECTO]** Se escribe con el mismo mecanismo atómico que ya usa el proyecto
(`atomic_write_json`), a fichero temporal y renombrado, de modo que nunca exista un archivo a medias.

**Qué ocurre cuando causalidad y rendimiento difieren.** **[DECISIÓN DEL PROYECTO]** Los tres campos son
**independientes y se publican los tres siempre**. No hay combinación implícita, no hay campo global de resumen y
**no hay ningún booleano agregado**, precisamente porque el booleano agregado es el defecto que se está corrigiendo.
Cualquier consumidor que quiera un sí o un no debe declarar por escrito qué combinación usa.

**[DECISIÓN DEL PROYECTO]** `RESULTADO_CAUSAL.json` **no habilita `ML-F2`**. Ver 6.4.

### 6.3 Criterio UTC, reformulado

**[DECISIÓN DEL PROYECTO]** El criterio de calidad UTC es:

> **|offset estimado| + incertidumbre certificable ≤ límite declarado**

**[DECISIÓN DEL PROYECTO]** La «incertidumbre certificable» es **propia de cada fuente** y **no se hereda entre
fuentes**. En particular, **no se reutiliza el δ/2 de la sonda HTTP contra Binance para chronyd**: son instrumentos
distintos y su incertidumbre se define de forma distinta.

- **Para chronyd:** **[ESTIMACIÓN]** la magnitud adecuada es la distancia de raíz que el propio chronyd publica,
  derivada de la demora de raíz y la dispersión de raíz. Los nombres exactos de campo se fijan en `TRANSICIÓN-T3`
  leyendo la salida real, no de memoria.
- **Para la sonda HTTP contra Binance:** δ/2, con δ el viaje completo. **[ESTIMACIÓN]** Con esta fuente el criterio
  es inalcanzable a 50 ms, y esa es precisamente la razón de no usarla como certificadora.
- **Para W32Time:** **[HECHO COMPROBADO]** el gate actual usa `|offset| ≤ L` sin sumar incertidumbre alguna, que es
  el defecto de fondo.

**[DECISIÓN DEL PROYECTO]** El límite `L` se declara **dentro del propio certificado**, no se codifica implícitamente.

**[DECISIÓN DEL PROYECTO]** El certificado de UTC calificada queda **diseñado y documentado, sin implementar**, hasta
que exista un consumidor concreto que lo necesite. **[HECHO COMPROBADO]** Hoy no existe en el proyecto ninguna fuente
externa con la que cruzar por marca de tiempo.

### 6.4 `ML-F2` no se abre con esto

**[DECISIÓN DEL PROYECTO]** `RESULTADO_CAUSAL.json` **no habilita automáticamente `ML-F2`**.

**[HECHO COMPROBADO]** La puerta de `ML-F2` es la existencia de `runs\CAPTURA_COMPLETA_AUDITADA.json`, y ese archivo
no cambia.

**[HECHO COMPROBADO]** La elegibilidad real de `ML-F2` depende de decisiones **no tomadas**:
`SKILL_QUANT_DEV_SENIOR.md:13` lista el «horizonte objetivo del modelo» como decisión material pendiente, y
`SKILL_QUANT_DEV_SENIOR.md:51` habla de «un horizonte explícito» sin declarar en qué reloj se mide.

**[ESTIMACIÓN]** Si el horizonte se define por índice de evento o por reloj monotónico, la exactitud UTC absoluta no
entra en las features ni en el objetivo. Si se define por reloj de pared, sí entra. **La definición del horizonte y
de las features debe preceder a cualquier afirmación sobre qué calidad de reloj necesita `ML-F2`.**

---

## 7. Contrato operativo de chronyd y systemd

**[DECISIÓN DEL PROYECTO]** Este contrato se fija **antes** de escribir nada y se verifica en `TRANSICIÓN-T3`.
**[ESTIMACIÓN]** Los nombres de campo concretos se confirman leyendo la salida real de la versión instalada; aquí se
declara la **semántica exigida**, no la sintaxis.

### 7.1 Antes de arrancar una captura

1. **Sincronización previa obligatoria.** El servicio debe llevar sincronizado un tiempo mínimo declarado antes de
   permitir el arranque. Arrancar con el disciplinador recién iniciado es exactamente el fallo de campo que se vio en
   Windows tras un reinicio.
2. **Fuente seleccionada e identificada.** Debe existir una fuente activa seleccionada, identificada por nombre, y
   quedar registrada. Una fuente local no disciplinada se rechaza, igual que hoy se rechaza el reloj CMOS local.
3. **Indicador de salto en estado normal.** Un estado de salto no normal impide arrancar una etapa certificable.
4. **Edad de la referencia dentro de un máximo declarado.** Una referencia vieja es una fuente muerta aunque el
   servicio siga vivo.
5. **Registro de la evidencia inicial**, con al menos: identificador de referencia, estrato, offset, demora de raíz,
   dispersión de raíz, distancia de raíz, indicador de salto, edad de la referencia y lista de fuentes con sus
   estadísticas.

### 7.2 Durante la captura

6. **Evidencia periódica sellada**, a intervalo declarado, en un archivo lateral propio dentro de la carpeta de la
   corrida. **[DECISIÓN DEL PROYECTO]** No se añaden columnas al CSV de eventos.
7. **Prohibido cualquier paso o salto forzado del reloj durante la captura.** El disciplinador debe estar configurado
   para corregir **solo deslizando** mientras haya una captura en curso. Esta es la traducción a Linux de la regla
   que `README_NTP_WINDOWS.md:18` ya impone en Windows.
8. **Prohibido reiniciar el servicio de reloj durante la captura.**
9. **Pérdida de fuente.** Si el disciplinador se queda sin fuente válida, **la captura no se detiene**: se registra
   el instante, la duración del hueco y el estado, y la calidad UTC de esa corrida pasa a `UNKNOWN` o a `FAIL` según
   el criterio de 6.3. **[DECISIÓN DEL PROYECTO]** El reloj nunca detiene una captura de datos íntegros.
10. **Detección de paso.** Si pese a la configuración se registrara un paso del reloj, se marca la corrida y se abre
    un bloqueo. Se apoya además en el detector de la sección 3.6, que en Linux tendrá mucha mejor resolución
    **[ESTIMACIÓN]** al no existir el cuanto de 15,6 ms.

### 7.3 Al cerrar

11. **Registro de la evidencia final**, con los mismos campos que la inicial, para poder acotar la deriva del periodo.
12. **Cierre seguro.** El proceso debe vaciar sus buffers y forzar la escritura a disco antes de terminar, y la
    unidad de servicio debe darle tiempo suficiente para hacerlo en vez de matarlo. **[DECISIÓN DEL PROYECTO]** El
    tiempo de gracia debe superar con margen el intervalo de escritura del proyecto. Matar el proceso antes de que
    termine de escribir es una forma de perder evidencia, y eso no se acepta.
13. **Arranque y supervisión.** La unidad de servicio ordena el arranque después del disciplinador y de la red, y
    **[DECISIÓN DEL PROYECTO]** no reinicia automáticamente una captura certificable que haya terminado: un reinicio
    silencioso convertiría dos corridas parciales en una aparentemente sana.

---

## 8. El plan de transición, reordenado

**Motivo de la reordenación:** la versión 2 era **circular**. Colocaba capturas reales en Linux antes de haber
adaptado el lanzador, las dependencias y el reloj, cuando esas capturas **no pueden existir** hasta que eso esté
hecho. El orden correcto es este.

### TRANSICIÓN-T0 — Evidencia y paquete vigente

Se divide en dos tareas independientes, y **solo la primera está autorizada hoy**.

#### T0A — Localizar y recoger la sesión exacta que falló · **AUTORIZADA**

**Qué se hace:** localizar la corrida que realmente falló y recogerla junto con su preflight correspondiente,
siguiendo el procedimiento de verificación de la sección 4.3. **Sin sobrescribir y sin instalar nada.**

**Qué resuelve:** que hoy **no hay ninguna prueba** de que el fallo reciente fuera del reloj.

**Cómo se comprueba que salió bien:** el zip contiene un `RESULT.json` cuya marca de tiempo y cuyo `status`
corresponden al fallo, y el `LISTADO_COMPLETO.txt` lo confirma.

**Qué necesita de Jean:** ejecutar un `.cmd` que ya tiene, comprobar el listado y, si eligió la corrida equivocada,
copiar a mano la carpeta correcta. **Ningún archivo nuevo, ninguna instalación.**

**[ESTIMACIÓN]** Coste: una tarde.

#### T0B — Verificar el paquete sellado 2.4.1 · **NO requiere instalar**

**Qué se hace:** verificar el paquete sellado de la versión vigente contra su manifiesto, comprobar los 144 archivos
y los cinco sellos de versión, **sin instalarlo**.

**[HECHO COMPROBADO]** Esta verificación ya se ejecutó parcialmente en esta sesión sobre
`entregables/JEAN_FLOW_555_META_QUANT_v2.4.1.zip`, comparando fichero a fichero contra el árbol 2.3.9: los siete
módulos de datos y los tres scripts de reloj son byte a byte idénticos; `launcher.py` cambia en 121 líneas sin tocar
el reloj; `latency.py` cambia en 50 líneas.

**[DECISIÓN DEL PROYECTO]** **Instalar la 2.4.1 queda fuera de T0 y requiere autorización posterior aparte.** La
versión 2 de este informe la pedía dentro de la fase 0 y eso era pedir de más.

### TRANSICIÓN-T1 — Especificación de plataforma y port mínimo experimental

**[DECISIÓN DEL PROYECTO]** Requiere autorización expresa que **hoy no se pide**.

**Qué se hace:**

1. **Inventario de compatibilidad**, que es el entregable principal y el que hoy no existe: enumerar cada punto del
   código atado a Windows, con archivo y línea, y su equivalente en Linux o su ausencia. Incluye como mínimo
   `latency.py` (temporizador fino y opt-out de degradación por energía), `launcher.py` (comprobación de elevación,
   rutas del sistema, invocación de PowerShell, rutas al estilo Windows), el subsistema completo de reloj, y los
   puntos de entrada.
2. **Especificación de la plataforma Linux**: distribución, versión de Python, política del planificador si la
   hubiera, disposición de directorios, usuario de servicio.
3. **Port mínimo experimental en un árbol separado**, que **no toca el paquete sellado** y que solo pretende arrancar
   el motor y correr el replay. No es producto, es sonda.

**Criterio de salida:** existe el inventario completo, con cada punto clasificado como «tiene equivalente directo»,
«requiere diseño» o «no tiene equivalente».

**[ESTIMACIÓN]** Coste: de una a dos semanas.

### TRANSICIÓN-T2 — Replay y pruebas offline

**Responde a UNA pregunta: ¿el motor produce en Linux el mismo estado canónico que en Windows?** No dice nada sobre
rendimiento, red ni conveniencia de migrar.

#### Qué se compara, y qué NO

**[DECISIÓN DEL PROYECTO]** **No se comparan los informes completos byte por byte.** **[ESTIMACIÓN]** Contienen rutas
de archivo, y una ruta de Windows nunca será igual que una de Linux, de modo que ese criterio fallaría siempre y por
un motivo que no tiene nada que ver con la fidelidad del motor.

Se comparan cuatro cosas, en este orden:

| Nivel | Qué se compara | Criterio |
|---|---|---|
| 1 | **Hashes de los journals de entrada** | Idénticos. Si no, se está replicando sobre datos distintos y todo lo demás sobra. |
| 2 | **`replay.sha256` canónico** | Idéntico. Es el sello del estado reconstruido y es independiente de rutas. |
| 3 | **Diccionario `replay` completo** | Idéntico campo a campo, tras excluir explícitamente los campos de ruta. |
| 4 | **Campos semánticos normalizados** | Idénticos. La lista se fija **antes** de ejecutar (ver abajo). |

**[DECISIÓN DEL PROYECTO]** La lista de campos semánticos y la lista de campos de ruta excluidos se **declaran por
escrito antes de la primera ejecución** y se sellan. Ampliar la lista de exclusiones después de ver una diferencia
está prohibido: eso es acomodar el criterio.

**Lista propuesta de campos semánticos, para revisión:** estado final del libro por mercado, número de eventos
aplicados, `ingest_seq_min` e `ingest_seq_max`, `ingest_unique_count`, `ingest_duplicate_identical`,
`ingest_conflicts`, contadores de deltas y de snapshots, y el veredicto de validez del replay.

#### Manifiestos

**[DECISIÓN DEL PROYECTO]** No se exige «los mismos sellos» para todo el árbol, porque es imposible por construcción:
las ruedas binarias y los archivos específicos de plataforma son distintos. La estructura correcta es:

- **Un manifiesto común del núcleo Python**, que cubre el código compartido y **debe** tener sellos idénticos en
  ambas plataformas. Una diferencia aquí es un bloqueo.
- **Un manifiesto por plataforma**, sellado y reproducible cada uno por su cuenta, que cubre ruedas binarias,
  puntos de entrada y utilidades específicas.

#### Batería de pruebas

**[DECISIÓN DEL PROYECTO]** No basta con el mismo número de pruebas superadas. Se exige:

1. **Los mismos identificadores de prueba** en el conjunto común, con **el mismo resultado** cada uno. Que coincida
   el total mientras cambian cuáles pasan es un fallo enmascarado.
2. **Cero omisiones nuevas sin justificar.** Cada omisión nueva lleva motivo escrito y queda registrada.
3. **Pruebas adicionales propias de Linux**, que hoy no existen: contrato de chronyd, unidad de servicio, cierre
   seguro con vaciado de buffers, permisos y usuario de servicio.

**[ESTIMACIÓN]** Coste: de dos a tres semanas, la mayor parte en el almacén de ruedas para Linux y en las pruebas que
hoy simulan Windows.

**Qué necesita de Jean:** nada. No toca su máquina.

### TRANSICIÓN-T3 — Candidato Linux con chronyd y systemd

**Qué se hace:** convertir el port experimental en un candidato real: sustituir la superficie PowerShell por lectura
del estado de chronyd, escribir la unidad de servicio, implementar el contrato de la sección 7, construir el
instalador equivalente y probarlo en frío y contra paquete adulterado, y dejar **un único punto de entrada**.

**[DECISIÓN DEL PROYECTO]** No se añaden pasos de doble clic ni configuraciones manuales. El objetivo declarado es
que Linux tenga **un solo** punto de entrada, y de paso resolver que hoy Windows tenga cinco con cuatro fuera del
paquete sellado.

**Criterio de salida:** el contrato de chronyd se cumple y se verifica; el instalador rechaza un paquete adulterado;
existe un único punto de entrada; y se mide **si la red de Jean permite el tráfico de reloj**, con el retardo mínimo
a las fuentes.

### TRANSICIÓN-T4 — Capturas reales y prueba completa

**Responde a otra pregunta distinta: ¿el sistema rinde y aguanta con la red real durante horas?**

#### Aritmética corregida

**[ESTIMACIÓN]** Una tanda es 10 + 30 + 120 minutos = **160 minutos**. Seis repeticiones son 960 minutos, es decir
**16 horas por plataforma**, y **32 horas entre las dos**, sin contar preparación, arranques, verificación entre
corridas ni repeticiones por bloqueo. La versión 2 decía «unas 9 horas por plataforma» y **estaba mal calculada**.

**[ESTIMACIÓN]** Con corridas intercaladas en franjas horarias equivalentes, eso son varias semanas de calendario, no
varios días.

#### Criterio de aprobación, corregido

**[DECISIÓN DEL PROYECTO]** El criterio se aplica **por corrida completa**, nunca por métrica suelta.

> **Una corrida pasa si, y solo si, todos sus gates con umbral, su integridad causal y su estado terminal pasan
> conjuntamente.**

**Motivo de la corrección:** el criterio de la versión 2, «5 de 6 por cada métrica», permitía que **ninguna corrida
completa estuviera sana** y aun así el conjunto apareciera aprobado. Si cada métrica falla en una corrida distinta,
las seis corridas tienen un fallo cada una y el criterio anterior las habría dado todas por buenas. Era un defecto
grave y se retira.

**[DECISIÓN DEL PROYECTO]** Cada corrida que no pasa **abre un bloqueo** (sección 9) que hay que explicar y cerrar
antes de continuar. No se promedia, no se descarta como «atípica» y no se sustituye por otra corrida sin registrar
por qué.

| Qué se evalúa en cada corrida | Límite vigente |
|---|---|
| `parse` percentil 99 | 5 ms |
| `book_apply` percentil 99 | 5 ms |
| `book_pipeline_total` percentil 99 | 5 ms |
| `writer_cooperative_yield` percentil 99 | 5 ms |
| `event_loop_lag` percentil 99 | 40 ms |
| Contadores de fallo, overflows y reinicios de salud | 0 |
| Integridad causal completa | PASS |
| Etapa sana completa | 600 s, 1800 s o 7200 s exactos |
| Estado terminal | Presente y único |

**[HECHO COMPROBADO]** El límite de 40 ms de `event_loop_lag` está justificado en el código por el cuanto de
15,625 ms del temporizador de Windows. **[DECISIÓN DEL PROYECTO]** **No se relaja para Linux bajo ningún concepto.**
**[HIPÓTESIS]** Es probable que en Linux el número correcto sea más estricto; endurecerlo sería un cambio explícito
con versión nueva, jamás una relajación silenciosa.

**[DECISIÓN DEL PROYECTO]** `exchange_to_receive` **no** entra en los criterios: es de reloj cruzado y el ruido de
red la domina. Se publica.

### TRANSICIÓN-T5 — Aceptación y reversión ensayada

**[DECISIÓN DEL PROYECTO]** La migración se autoriza cuando se cumplan **todas**:

1. El estado canónico del replay coincide en los cuatro niveles de T2.
2. El manifiesto común del núcleo tiene sellos idénticos; los manifiestos por plataforma son reproducibles.
3. La batería común pasa con los mismos identificadores y resultados; las omisiones nuevas están justificadas;
   existen las pruebas propias de Linux.
4. Las corridas de T4 pasan **por corrida completa**, sin relajar ningún umbral.
5. El contrato de chronyd y systemd se cumple y se verifica.
6. El instalador de Linux está probado en frío y contra paquete adulterado.
7. Existe **un único** punto de entrada.
8. Está escrito y probado cómo se sigue auditando la evidencia histórica capturada en Windows, que
   **[DECISIÓN DEL PROYECTO]** es intocable.
9. **La reversión está ensayada, no solo escrita.** Volver a Windows y capturar debe demostrarse en una prueba real,
   no describirse en un párrafo.

### 8.6 Dónde correr Linux: se decide después, no ahora

**[DECISIÓN DEL PROYECTO]** La versión 2 llamaba al arranque desde USB «comparación limpia» y al mini-PC «riesgo
cero». **Ambas afirmaciones se retiran.**

- **[ESTIMACIÓN]** El arranque desde USB **no** da una comparación limpia: el almacenamiento es distinto, y este
  producto escribe journals continuamente y fuerza la escritura a disco de forma periódica. Comparar entrada y salida
  sobre una memoria extraíble contra un disco interno mide el soporte, no la plataforma.
- **[ESTIMACIÓN]** El mini-PC **no** tiene riesgo cero: tiene riesgo distinto. No arriesga la máquina de Jean, pero
  introduce otro procesador, otro disco y otra ruta de red, de modo que la comparación deja de ser entre plataformas
  y pasa a ser entre equipos.
- **[ESTIMACIÓN]** La nube sirve para fidelidad y estabilidad, no para medir la red de Jean.

**[DECISIÓN DEL PROYECTO]** La ubicación definitiva **se decide después del inventario de compatibilidad de T1**,
cuando se sepa qué exige realmente el port. Decidirlo antes sería elegir el laboratorio sin saber qué experimento hay
que hacer.

---

## 9. Registro de bloqueos

**[DECISIÓN DEL PROYECTO]** Cada fallo abre una entrada con esta forma, y no se continúa hasta clasificarla:

```
BLOQUEO <número> — <título>
  Etapa:           TRANSICIÓN-T<n>
  Qué falló:       <hecho medido, con el número>
  Criterio:        <el criterio fijado ANTES del experimento>
  Corrida:         <identificador de la corrida completa afectada>
  Clasificación:   SE CORRIGE | EXIGE OTRO EQUIPO | REPLANTEA LA ESTRATEGIA
  Evidencia:       <rutas de los archivos>
  Decisión:        <pendiente de Jean, o resuelta y cómo>
```

**[DECISIÓN DEL PROYECTO]** Prohibido: ajustar un criterio después de ver el número; ampliar la lista de campos
excluidos del replay después de ver una diferencia; promediar entre plataformas o entre corridas para disimular un
fallo; declarar «diferencia aceptable» sin cuantificarla; presentar como aprobada una etapa con un bloqueo abierto.

### Riesgos pendientes abiertos

| Nº | Riesgo | Estado |
|---|---|---|
| 1 | El orden de segmentos no está garantizado por K1 (sección 3.3) | Abierto. No se corrige código. Se cierra con un caso de prueba. |
| 2 | El detector de saltos no ve por debajo de unos 20 ms en Windows | Abierto. **[ESTIMACIÓN]** Mejora sola en Linux al desaparecer el cuanto. |
| 3 | No está medido si la red de Jean permite el tráfico de reloj | Abierto. Se mide en T3. |
| 4 | No está verificado que la RTX 3050 y CUDA sirvan para `ML-F2` en Linux | Abierto. Afecta a dónde vive `ML-F2`. |
| 5 | Doble mantenimiento durante toda la transición | Abierto. **[ESTIMACIÓN]** Es el coste continuo más alto. |

---

## 10. Lo que NO se hace

- No se toca `RESULT.pass` ni `CAPTURA_COMPLETA_AUDITADA.json`.
- No se baja ni se mueve ningún umbral.
- No se fabrica nunca un `PASS`. Si la calidad UTC no se puede demostrar, se publica `UNKNOWN`.
- No se emite `RESULTADO_CAUSAL.json` incompleto: o está entero o no está.
- No se añaden archivos `.cmd`, configuraciones manuales ni pasos de doble clic.
- No se usan WSL2, Docker ni máquina virtual como solución definitiva. **[ESTIMACIÓN]** El reloj y el planificador de
  debajo seguirían siendo los del anfitrión.
- No se escribe Rust ni Go salvo que las mediciones demuestren la necesidad.
- No se implementa el certificado UTC calificado hasta que exista un consumidor concreto.
- No se toca la evidencia histórica: `runs\` es de solo lectura.
- **No se instala la 2.4.1 sin autorización posterior aparte.**

---

## 11. Qué se pide autorizar ahora

**Únicamente `TRANSICIÓN-T0A`:** localizar y recoger la sesión exacta que realmente falló, con su preflight
correspondiente, **sin sobrescribir ni instalar nada**, siguiendo el procedimiento de verificación de la sección 4.3
para comprobar que se recogió la corrida correcta.

**No se pide:** instalar la 2.4.1, modificar código, portar el motor, ejecutar pruebas en Linux, ni decidir dónde
correr Linux.

Con esa evidencia sobre la mesa se podrá decir, con una cita, si el fallo reciente fue del reloj o de otra cosa. Y
`TRANSICIÓN-T1` podrá presupuestarse contra datos reales en vez de contra un informe escrito.

---

*Fin del informe. Cada afirmación lleva su etiqueta. Las que no se pudieron verificar están marcadas como hipótesis o
como riesgo pendiente en vez de rellenarse con suposiciones.*
