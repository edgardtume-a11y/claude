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
