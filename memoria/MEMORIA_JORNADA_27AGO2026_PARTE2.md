# MEMORIA DE JORNADA — 27/08/2026, PARTE 2 (tarde UTC)

Continuación de MEMORIA_JORNADA_27AGO2026.md. Punto de restauración completo.
Contexto vivo también en Notion: página 19 (bloques 16O→16Q) y Memoria operativa.

## Cronología (UTC)

| Hora | Hito |
|---|---|
| 12:18 | Puente RDC recuperado tras caídas; veredicto Gate 1 Tokio leído: **latencia E2E p50 3,05 ms (12× mejor que Singapur)**, datos íntegros, métricas internas FAIL (book_apply 5,425 / book_pipeline 7,322 / writer_yield 6,944 vs 5,0) por máquina de 4 vCPU |
| 12:21–12:24 | **Stack propio de Tokio**: credenciales quemadas renombradas, desktop-commander con identidad NUEVA (device 2985827f…), operador autorizó código 7VNF-8KWA |
| 12:29 | **Operador (Cloud Shell): Singapur APAGADA** (reversible) + Tokio ampliada 4→8 vCPU |
| 12:35 | Segunda ampliación por orden del operador: **Tokio a e2-custom-12-49152 (12 vCPU / 48 GB)** — usa toda la cuota |
| 12:34 | Rutina de monitoreo horario reapuntada a Tokio |
| 12:38–12:45 | **Gate 2 con flujo completo**: staging 20260827T123816Z_tokyo12_capture_gate2_30m (sesión 713de915…), orden a Gemini por socket del router (clave tokyo12-gate2-30m-v1; idempotencia verificada en vivo: duplicate=true en reintento), Gemini 3.7 escribió en 4 min, revisión independiente 10/10 → **ACEPTADO** |
| 12:46 | Captura 30 min lanzada (LIVE_STARTED) |
| ~13:20 | **LIVE_FINISHED engine_rc=0, 0 parciales** (confirmado por operador vía Cloud Shell, RDC caído) |
| 13:0x | Puerta HTTPS universal verificada: túnel cloudflared reactivado en Tokio (conflicto de identidad ya no existe con Singapur apagada); navegador del operador recibió "unauthorized: se requiere Bearer token" → **puerta viva y blindada**. Token del puente en /home/trading/.config/jean-flow-unrestricted/job_token, rotación automática en cada arranque del servicio jean-flow-bridge; token expuesto en chat → rotado |
| 13:3x | **Decisión del operador: puente GitHub** como vía para Claude (mi entorno bloquea todo dominio no listado; GitHub sí está permitido). Construido guardián v1 (watcher.py + systemd puente-github): acciones cerradas gemini_enqueue / gemini_result / estado; órdenes en puente_github/ordenes/, resultados en puente_github/resultados/, idempotencia por id de archivo |
| 13:4x | Saga instalación: PAT de GitHub (puente-tokio, cuenta edgardtume-a11y, Contents RW sobre repo claude; el operador decidió mantenerlo tras exposición en chat); credenciales de Cloud Shell rotas → gcloud auth login completo; primera llave guardada resultó enmascarada (puntitos •, 264 bytes) → detectado con head -c y wc -c → reguardada la real (94 bytes) |
| 13:54 | **PRIMERA RESPUESTA POR EL PUENTE GITHUB**: orden "estado" → {nproc:12, load 0.00, 138G libres} — independencia total del conector RDC lograda |
| 13:57 | Guardián **v2** instalado (acciones nuevas: auditar_staging, leer_archivo, latencia_e2e — solo bajo staging_runs/). **Latencia E2E Gate 2 (12 vCPU): n=20.842, min 1,44 / p50 2,05 / p90 7,43 / p99 23,93 ms** — la cola p99 pasó de 53,68 (4 vCPU) a 23,93: hipótesis de CPU confirmada. Auditorías lanzadas por el puente |
| 13:59 | Prueba Gemini de extremo a extremo por el puente: router encoló job jfr-33aa29… (pendiente de leer resultado) |

## Estado de las máquinas
- **jean-flow-01 (Singapur)**: APAGADA por orden expresa (no borrada; reversible). Su disco conserva todo.
- **jean-flow-02-tokyo**: e2-custom-12 (12 vCPU/48 GB), IP fija 34.180.96.105, disco 138G libres.
  Servicios activos: jean-flow-router (timeout 900 s), jean-flow-gemini, jean-flow-bridge (+cloudflared túnel), desktop-commander (identidad propia), **puente-github (guardián v2)**.

## Vías de acceso (jerarquía vigente)
1. **Puerta HTTPS universal** `https://jean-flow-gcp.lorvellancapital.com` — para IAs con internet (<1 s). Token rotativo, en manos del operador.
2. **Puente GitHub** — para Claude en entornos restringidos (~30-60 s). Guardián v2, PAT en /home/trading/.config/puente-github/pat.
3. RDC (conector claude.ai) — emergencia; inestable todo el día.
4. Cloud Shell del operador — manual, siempre funciona (ojo: credenciales caducan; cura = gcloud auth login completo con Y).
- Documentación: operaciones/MANUAL_PUERTA_UNIVERSAL_JEAN_FLOW.md y puente_github/ (este repo).
- Opcional futuro: abrir Network access del entorno claude.ai/code → Claude usaría la puerta HTTPS directo en sesiones nuevas.

## Pendientes al cierre de este respaldo
1. **Veredicto Gate 2**: auditorías corriendo; leer audit/return_codes.json vía puente (orden leer-codigos-gate2-001 programada). Si metrics=0 → gate 30 min CERTIFICADO → pedir orden del operador para el gate de 2 h.
2. Resultado de la prueba Gemini (job jfr-33aa29…).
3. **Parquet** (orden del operador): instalar pyarrow en el venv del colector + prueba ida-y-vuelta con datos reales + factor de compresión; luego conversor definitivo vía flujo Gemini. Vigilante cron esperando vía de ejecución.
4. Copiar a Notion el manual y los bloques 16R+ (Notion intermitente).
5. Recordatorio al operador: recortar permisos del PAT a solo Contents RW (quedó con permisos amplios).
6. Escalera tras certificación: 2h → 6h → Parquet certificado → 24h → 7 días. Ningún lanzamiento sin orden.

## Lecciones nuevas del día (parte 2)
- Un solo canal de control = punto único de falla; hoy quedaron cuatro vías complementarias.
- Terminales que enmascaran secretos (••••) pueden guardar la máscara literal: verificar con head -c y wc -c.
- Secreto expuesto en chat: rotar de inmediato (bridge token rotado; PAT quedó por decisión del operador).
- Credenciales de Cloud Shell caducan: la cura real es gcloud auth login completo (responder Y y pegar el código), no config set account.
- Más vCPU sí arregla colas p99 internas: 53,7 → 23,9 ms al pasar de 4 a 12.

## Anexo 14:25 UTC — Veredicto Gate 2 y decisión n2 (pendiente de copiar a Notion como 16R)

- Auditorías Gate 2 (12 vCPU): journal_spot 0 ✅ journal_usdm 0 ✅ identity 0 ✅ metrics 2 ❌.
- Detalle métricas (peor ventana vs límite 5,0 ms): spot writer_yield 6,091 · usdm book_pipeline 5,462 · usdm writer_yield 5,270. book_apply ahora PASA; 0 fallos de invariantes (antes 1).
- Latencia E2E 12 vCPU: n=20.842, min 1,44 / p50 2,05 / p90 7,43 / p99 23,93 ms (p99 mejoró de 53,68).
- Diagnóstico: el patrón marginal persiste en familia e2 (CPU compartida/steal); ya no es cantidad de vCPU.
- DECISIÓN DEL OPERADOR: cambiar a n2-standard-8 (dedicada). Ejecutado ~14:22 UTC vía Cloud Shell; verificado por el puente: nproc=8, guardián sobrevivió al reinicio.
- Gemini por el puente: prueba end-to-end OK ("JEAN_FLOW_PUENTE_GITHUB_OK", gemini-3.7-flash).
- Diálogo filosófico Claude-Gemini sobre el amor iniciado en filosofia/QUE_ES_EL_AMOR.md (orden lúdica del operador; respuesta de Gemini r1 pendiente de recoger).
- Guardián v3 publicado (revisar_staging/lanzar_captura/ejecutar_script_repo + scripts/parquet_prueba.sh); pendiente instalador del operador.
- Siguiente cadena: instalador v3 → prueba Parquet → gate 2h flujo Gemini en n2.

## Anexo 17:35 UTC — Puente GitHub en producción, Parquet aprobado, Gate 3 en curso

### Cambio de era operativa: el puente GitHub sustituyó al conector RDC
- Guardián v3 en producción (systemd `puente-github`, sobrevive reinicios). Acciones cerradas:
  `estado`, `gemini_enqueue`, `gemini_result`, `auditar_staging`, `leer_archivo`,
  `latencia_e2e`, `revisar_staging` (pytest), `lanzar_captura` (con guarda anti-doble-arranque),
  `ejecutar_script_repo` (solo scripts versionados en puente_github/scripts/).
- Idempotencia por id de archivo: un id ya respondido nunca se reprocesa.
- Circuito verificado de extremo a extremo: orden → GitHub → guardián → router → Gemini 3.7
  → resultado → GitHub ("JEAN_FLOW_PUENTE_GITHUB_OK").
- Latencia práctica del puente: 25-60 s por orden, CERO caídas (vs RDC que cayó ~6 veces en el día).
- Documentación: tutoriales/TUTORIAL_PUENTE_GITHUB.md (paso a paso reproducible) y
  operaciones/BITACORA_COMANDOS_27AGO2026.md (comandos crudos sanitizados).

### Parquet — etapa 1 APROBADA (14:5x UTC)
- pyarrow 25.0.1 instalado en el venv del colector.
- Prueba con 50.001 filas reales del gate 1 (usdm_futures): CSV → Parquet → CSV,
  tabla IDÉNTICA tras ida y vuelta (`tabla.equals(tabla2) == True`).
- **Compresión 71,93×** (19.822.897 → 275.579 bytes) con zstd. Hash muestra ce4ad11df4efd1d7.
- Conclusión: Parquet habilitado técnicamente; el conversor definitivo se autoriza vía
  flujo Gemini antes de gates ≥24 h.

### Gate 3 (2 horas, n2-standard-8 dedicada) — EN CURSO
- Preparación por el puente: staging 20260827T143004Z_tokyo_n2_capture_gate3_2h,
  sesión c37b7c55fca84a6cb08afb8bb43d1a08.
  Tropiezo y cura: `cp -a` falló por restos de __pycache__ de root → se copia el overlay
  con `tar --exclude` (lección para futuros preparadores).
- Contrato a Gemini vía puente (clave tokyo-n2-gate3-2h-v1) → `JEAN_FLOW_GATE3_FILES_OK`.
- Revisión independiente: primera pasada FALLÓ (2 tests) — el revisor detectó **pruebas
  fantasma** de gates anteriores arrastradas en el overlay (test_30m_gate.py, test_2h_gate.py
  con sesiones/raíces viejas). Retiradas por el revisor → segunda pasada **10/10 PASSED**.
  El flujo autor→revisor volvió a atrapar un defecto real que el autor no vio.
- Captura lanzada 15:05 UTC con guarda anti-doble-arranque (engine_pid 4444).
- Seguimiento 17:34 UTC: sigue grabando (2h29), **load 0.34 en 8 vCPU dedicados**
  (el más bajo del día — buena señal para las métricas marginales), disco 127G libres, 0 errores.
- Veredicto automático encadenado: estado → auditorías → return_codes → latencia_e2e → A/B.

### Documentos nuevos del día
- planes/PLAN_FASE2_ENTRENAMIENTO.md — escalera de modelos (LightGBM primero, confirmado
  por el protocolo jean-flow-555), pipeline, métricas y enemigos (leakage, overfitting, costos).
- planes/CONTRATO_FEATURES_V1.md — 14 features (libro, flujo, contexto) + labels
  (retorno 5s/30s y triple-barrera 60s) + 4 reglas anti-leakage como pruebas. PENDIENTE
  DE APROBACIÓN DEL OPERADOR.
- planes/EVALUACION_ARCTICDB.md — veredicto: Parquet+Polars ahora; ArcticDB candidata
  oficial para la fase multi-símbolo (memecoins) por su versionado de datasets.
- memoria/PENDIENTES_HANDOFF.md — pendientes vivos + notas del operador (marca QUANTFLOW/
  Lorvellan, AWS Tokio futuro, memecoins, bot fase 4, facturación, proyecto de Derecho).
- filosofia/QUE_ES_EL_AMOR.md — diálogo Claude↔Gemini por el puente (rondas 1-2), orden lúdica
  del operador; sirve además como prueba viva de que el canal Gemini funciona para tareas libres.

### Costos (verificado 27/08)
- n2-standard-8 en Tokio: ~$260/mes con descuento por uso sostenido (la e2-custom-12 previa
  costaba ~$420 sin descuento) → **la máquina dedicada salió MÁS BARATA**. +$10 disco, +$4 IP.
- Disco de Singapur apagada: ~$10/mes (seguro de respaldo, se elimina solo por orden expresa).
