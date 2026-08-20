# INFORME — Comparación del RC de ChatGPT y construcción del candidato 2.4.1+linux.1

**Fecha:** 20 de agosto de 2026.
**Entrada:** `JEAN_FLOW_2.3.4linux.2_x86_64.zip` (port a Linux construido por ChatGPT), con el encargo
«compara y mejora todo».
**Salida:** `JEAN_FLOW_555_META_QUANT_v2.4.1+linux.1.zip` — candidato Linux construido sobre la **versión
vigente 2.4.1 sellada**, por el **pipeline oficial de release**, conservando los aciertos del RC de ChatGPT y
corrigiendo sus defectos. Etiquetas del plan rector: [HECHO COMPROBADO] / [ESTIMACIÓN] / [DECISIÓN DEL PROYECTO].

---

## 1. Veredicto sobre el trabajo de ChatGPT, sin regatearle mérito

**Es un buen port.** Validado empíricamente en este entorno Linux:

| Validación | Resultado |
|---|---|
| Manifiesto del release (`RELEASE_MANIFEST.sha256`) | **[HECHO COMPROBADO]** 147/147 sellos OK — lo regeneró correctamente |
| Cadena de suministro (lock == manifiesto == ruedas) | **[HECHO COMPROBADO]** 20/20; sus ruedas son byte a byte idénticas a las que yo verifiqué contra PyPI |
| Batería de pruebas | **[HECHO COMPROBADO]** 235 superadas, 2 omitidas (red opt-in), 0 fallos |
| Replay causal sobre la corrida real `d64fea5560ac` | **[HECHO COMPROBADO]** sellos idénticos a los de Windows en spot y futuros, PASS/PASS |

**Sus aciertos, que el candidato nuevo adopta:**

- **[HECHO COMPROBADO]** Cierre por **SIGTERM drenado** (systemd → mismo camino que Ctrl+C: commitment,
  auditoría, RESULT).
- Módulo de reloj `clock_linux.py` con `chronyc -n -c tracking` (CSV, 14 campos validados uno a uno,
  frescura 2·intervalo+60 s, binario de confianza de root); **sidecar** que guarda evidencia continua del
  reloj durante la captura con doble marca utc+monotónica (`informational_only: true`); modos nuevos
  `--mode offline` y `--mode preflight`; **gate de disco** previo a sesiones en vivo.
- **[HECHO COMPROBADO]** Un hallazgo de defecto REAL que también afecta a la 2.4.1 de Windows: el log de
  métricas rota (`RotatingFileHandler`, 64 MiB × 5) y el auditor solo leía el archivo base
  (`launcher.py:1619` en la 2.4.1) — en corridas largas la serie auditada quedaría incompleta. Su
  corrección (leer todos los fragmentos en orden causal) va incluida en el candidato, y **debería
  aplicarse también a la rama Windows en la próxima versión**.
- Lock POSIX **sin unlink** (elimina una carrera clásica de flock), instalador con releases versionados en
  `/opt` y **rollback atómico**, unidad systemd seriamente endurecida (hasta `ProtectClock=yes`: el motor no
  puede tocar el reloj ni comprometido), rechazo de root en bootstrap y entrada, `-X utf8` en el bootstrap,
  y un `CORE_SOURCE_MANIFEST` que sella aparte los módulos causales.
- Un LEEME honesto que declara sus propios límites.

**Sus dos defectos de fondo, y por qué obligaban a rehacer el paquete:**

1. **[HECHO COMPROBADO]** **Base 2.3.4** — cuatro versiones detrás de la vigente. Su propio LEEME lo admite:
   «el código recibido es 2.3.4; el informe adjunto describe un 2.4.1 que no fue suministrado». No es culpa
   de ChatGPT: nunca tuvo el paquete sellado 2.4.1. Pero el port pierde, entre otras, la **exclusión de
   calentamiento de 120 s del gate p99** (2.3.9 — parte del criterio vigente del protocolo) y la política de
   panel/navegador con su evidencia `browser.json` (2.4.1). Parte de lo que su LEEME presenta como mejoras
   (abortar la escalera al fallar data gates, `--no-browser`) **ya existía en la 2.4.x** — reinventos
   producto de la brecha de versión.
2. **[HECHO COMPROBADO]** **Cambió el criterio del reloj sin autorización**: su gate bloqueante es
   |offset| + dispersión_raíz + retardo_raíz/2 ≤ 50 ms — exactamente el certificado UTC calificado que
   **[DECISIÓN DEL PROYECTO]** el plan rector §6.3 diseñó y decidió **no implementar como gate** hasta que
   exista un consumidor. Es más estricto, no más laxo, pero redefine el significado del PASS del reloj — la
   clase de cambio silencioso de criterio que el protocolo prohíbe. (Detalle menor del mismo módulo: emite
   `quality_utc: "INSUFICIENT"`, vocabulario ajeno al plan.)

Menores: el RC mantiene `Restart=always` con `RuntimeMaxSec=24h` (reinicio diario forzado de la captura
continua — defendible, pero es política nueva), su fragmento de chrony no declara pools mínimos con
`minpoll/maxpoll`, y no trae recogedor de evidencia (la política de RECOGER_EVIDENCIA_TODO quedó sin
equivalente).

---

## 2. El candidato 2.4.1+linux.1 — qué es y cómo se validó

**Construcción:** árbol sellado **v2.4.1** + cambios del port aplicados quirúrgicamente + correcciones. El
gate del reloj vuelve al criterio vigente (|offset| ≤ 50 ms, mismo número y sentido que en Windows) y la
banda honesta se **publica** como `utc_calificada` DEMOSTRADA/INSUFICIENTE/UNKNOWN — informativa, nunca
veta (hay una prueba que fija exactamente eso: `test_la_calidad_utc_es_informativa_y_nunca_niega_el_gate`).

**[HECHO COMPROBADO]** `CORE_SOURCE_MANIFEST.sha256` sella los 11 módulos del núcleo causal
**byte a byte idénticos a los del paquete sellado v2.4.1** (11/11 verificados) — el candidato puede probar
criptográficamente que no tocó la fidelidad.

**Validación, toda sobre el ZIP sellado extraído en frío:**

| Qué | Resultado |
|---|---|
| Pipeline oficial `tools/build_release.py` | **[HECHO COMPROBADO]** PASS: wheelhouse validado offline (tags manylinux), árbol validado, manifiesto de **161 archivos**, verificación en frío con el mismo verificador del bootstrap |
| Manifiesto tras extracción en frío | **[HECHO COMPROBADO]** 160/160 sellos OK |
| Batería de pruebas | **[HECHO COMPROBADO]** **280 superadas, 2 omitidas, 0 fallos** (las 263 de la 2.4.1 + las nuevas de Linux) |
| Replay causal (corrida real, ~1,2 M filas) | **[HECHO COMPROBADO]** sellos canónicos **idénticos a los de Windows** en spot (`e9d8a230…`) y futuros (`beff8f18…`), PASS/PASS |
| Wheelhouse | **[HECHO COMPROBADO]** 20 ruedas exactas del lock; 13 puras byte a byte iguales a las selladas de Windows; 7 manylinux compiladas verificadas contra PyPI |
| Sello del ZIP | `a4f6bbbe66592fc14a758d76ed3b2b50cbeba7f8a3de33746914758e5b3df468` (5,25 MB) |

**Límites, sin adornos:** este candidato está validado **offline**. chrony real, systemd como supervisor,
red Binance y la escalera 10/30/120 de la Fase 2 solo pueden probarse en el VPS decidido el 20 de agosto.
Ninguna captura es certificable hasta que eso ocurra, y los umbrales que deciden son los vigentes, sin
relajar ninguno.

---

## 3. Tabla de diferencias del candidato frente al RC de ChatGPT

| Tema | RC ChatGPT (2.3.4+linux.2) | Candidato (2.4.1+linux.1) |
|---|---|---|
| Base del motor | 2.3.4 (histórica) | **2.4.1 sellada vigente** |
| Exclusión de calentamiento del gate p99 (2.3.9) | ausente | presente (viene con la base) |
| Política de panel + `browser.json` (2.4.1) | reimplementación parcial | completa (viene con la base) |
| Gate del reloj | banda ≤ 50 ms (criterio cambiado) | **|offset| ≤ 50 ms (criterio vigente)** + banda publicada |
| Vocabulario de calidad UTC | `INSUFICIENT` | `DEMOSTRADA / INSUFICIENTE / UNKNOWN` (el del plan) |
| Métricas rotadas en el auditor | corregido | corregido (adoptado) |
| SIGTERM, modos offline/preflight, gate de disco, sidecar, instalador+rollback, lock estable | sí | sí (adoptados) |
| Recogedor de evidencia | no existe | `tools/linux/recoger_evidencia.sh` con la política literal del `.cmd` (solo informes, ≤100 MB, jamás CSV) |
| Núcleo causal | intacto respecto de 2.3.4 | intacto respecto de **2.4.1**, sellado y validado por el pipeline |
| Batería | 235/2 | **280/2** |
| Pruebas del criterio del reloj | fijan la banda como gate | fijan que la banda **no** es gate (decisión del plan) |

---

## 4. Ronda 1 de mejora continua (mismo día, encargo «no pares»)

El candidato se endureció y re-selló como **2.4.1+linux.2** (sello
`8432df4844e760411f7dc87da3234ad29204e936d6ec5b9f85a378690f6d267a`), que sustituye al linux.1:

- **Verificación adversarial de tres sospechas de defecto en lo construido — las tres descartadas con
  evidencia:** [HECHO COMPROBADO] la máquina de estados del manifiesto permite STOPPING→STOPPING
  (`runtime.py:24-31`), los estados que busca el sidecar son exactamente los de `RUNTIME_STATES`
  (`runtime.py:21-23`), y el motor hijo hereda el entorno completo del bootstrap
  (`environment = os.environ.copy()`), con lo que `JEAN_FLOW_RUNTIME_ROOT` llega a los hijos aislados.
- Recolección de métricas rotadas refactorizada a `_metrics_series_paths()` **unitariamente testeada**
  (orden causal, symlinks y sufijos espurios excluidos, fallo cerrado con base ausente); `disk_preflight`
  endurecido (un `OSError` al examinar el disco ya no revienta con traceback: falla cerrado con código);
  12 pruebas nuevas (gate de disco ×4, envolturas del reloj ×3, serie rotada ×4, lock estable ×1).
  **Batería: 292 superadas, 2 omitidas, 0 fallos**, también desde el ZIP extraído en frío.
- **Prueba de punta a punta del camino de un clic, como usuario sin privilegios:** [HECHO COMPROBADO]
  `python3.12 -X utf8 -I -S -B -u jean_flow_launcher.py --mode offline` desde el ZIP frío construyó el
  runtime verificado por sellos sin red, aceptó Linux, y emitió `OFFLINE_READY` con `pass: true`
  (integridad 161 archivos + batería 292/2 + benchmark, todo dentro de los hijos aislados reales;
  evidencia en `transicion_linux/evidencia/OFFLINE_READY_linux2_endtoend.json`). Ejecutado como root,
  el bootstrap **se negó** con `ROOT_PROCESS_FORBIDDEN` — el rechazo de privilegios funciona.
- **Fallo cerrado demostrado en vivo:** `--mode preflight` en este contenedor se detuvo con
  `DISK_SPACE_INSUFFICIENT: libres=29.3 GiB (11.6%)` — el gate de disco nuevo actuando antes del reloj,
  con código y números claros. (El VPS decidido, con NVMe ≥100 GB, lo supera.)

**Además: candidato 2.4.2 para Windows.** [HECHO COMPROBADO] El defecto de métricas rotadas afecta a la
2.4.1 de Windows; se preparó la corrección quirúrgica sobre el árbol sellado (un solo cambio funcional +
4 pruebas + `CAMBIOS_v2.4.2.md`), construida por el **pipeline oficial original** (win_amd64): 267/2 en
verde, 147 archivos, sello `8eafe1b9d54591d091650e2001790c9289b65fe4de117c680f3b0da4cb3d84f8`.
[DECISIÓN DEL PROYECTO pendiente] Instalarla en el Windows de Jean es decisión de Jean; el candidato queda
en `transicion_linux/candidato/`.

### Ronda 2 — el subsistema de reloj probado con chrony REAL

Se instaló chrony de repositorio en el contenedor y se montó un par de chronyd locales por loopback
(servidor de estrato 8 + cliente con `-x`, sin tocar el reloj del host), para ejercitar el candidato
contra el binario de producción. **[HECHO COMPROBADO]** Resultados
(`transicion_linux/evidencia/laboratorio_chrony_linux2.md`):

- **Camino PASS real:** `clock_linux` como usuario sin privilegios contra el chronyd sincronizado →
  `PASS` con offset 0,0064 ms, banda ±0,0093 ms, `utc_calificada: DEMOSTRADA`. (Prueba el MECANISMO;
  la exactitud UTC real es de la Fase 2 en el VPS.)
- **Tres fallos cerrados reales:** daemon detenido → `CHRONYC_COMMAND_FAILED`; daemon sin fuente →
  `CHRONY_UNSYNCHRONIZED`; bootstrap como root → `ROOT_PROCESS_FORBIDDEN` sin iniciar nada.
- **Sidecar en vivo:** JSONL válido con doble marca temporal, `tracking.pass=true`,
  `informational_only=true` y correlación de sesión correcta (null sin captura activa).
- **Superficie completa:** `./INICIAR.sh --mode offline` → `OFFLINE_READY` (batería 292/2 dentro de
  los hijos aislados reales).

## 5. Qué queda para autorizar de verdad la migración

Sin cambios sobre el plan rector: la Fase 2 en el VPS (chrony real, systemd, red, escalera 10/30/120 con
umbrales vigentes), el registro de bloqueos si algo falla, y las ocho condiciones de la Fase 4. Este
candidato deja todo listo para ejecutarla; no la sustituye. La Fase 0 (evidencia del último fallo reciente,
desde Windows) sigue pendiente y sigue siendo de Jean.
