# MEMORIA DE JORNADA — 27/08/2026 (sesión Claude Code)

Registro notarial de la jornada. El contexto vivo y detallado está en Notion
("Contexto actual — JEAN FLOW AWS → GCP" → bloque "⭐ CONTEXTO VIGENTE CONSOLIDADO — Cierre 14"
y página "19 — Seguimiento en vivo", sincronizaciones 16G→16N).

## Cronología resumida (UTC)

| Hora | Hito |
|---|---|
| 03:17 | Claude Code conectado vía Remote Desktop Commander; contexto recuperado de Notion |
| 03:50 | **Causa raíz del timeout hallada y corregida**: el router imponía 120 s a todos los jobs de Gemini (todos los fallos morían exactamente a 120 s). Drop-in systemd reversible: `JEAN_FLOW_ROUTER_TIMEOUT_SECONDS=900` |
| 04:14–04:26 | Gate 45 min: Gemini escribió → revisor detectó defecto real (continuaciones de línea rotas) → orden correctiva v2 → **ACEPTADO 10/10** |
| 04:07–06:07 | Captura Gate 2 h (lanzada por la sesión ChatGPT): completada COMPLETED RC 0 |
| 04:58–05:01 | Gate 6 h: autoría aceptada a la primera (contrato endurecido) — 10/10 |
| 05:30 | Latencia E2E medida sobre 19.553 eventos en vivo: **piso 37,5 ms desde Singapur** (p50 37,9 / p99 46,4) → el matching engine de Binance vive en AWS Tokio |
| 06:35 | Veredicto Gate 2 h: **datos íntegros** (journal×2 + identity PASS, 0 errores) pero certificación de métricas NO aprobada: 2 colas marginales en futuros (book_pipeline_p99 5,497/5,0; writer_yield_p99 5,044/5,0 — 44 µs de exceso) |
| 06:40 | Gate 6 h lanzado |
| 07:00 | **Pivote del operador**: migrar primero, certificar en Tokio. Captura 6 h detenida limpiamente (STOP contractual, rc=20) |
| 07:06 | Machine image en caliente creada |
| 07:10 | **jean-flow-02-tokyo creada en asia-northeast1-a** (e2-standard-4 por cuota de 12 CPUs) |
| 07:15–07:43 | Incidente del clon: identidad compartida quemó el refresh token → re-autorización por código (operador); cloudflared y agente DC desactivados en el clon |
| 07:44 | **IP fija reservada: 34.180.96.105** (Cloud Shell del operador) + bindings IAM a la cuenta de servicio |
| 07:47 | A/B REST: Tokio ~55 ms total vs Singapur ~105 ms (2×) |
| 07:55 | **Primer gate de 30 min EN TOKIO lanzado** (staging paramétrico del 45m v2 aceptado, suite 10/10 en Tokio) — veredicto automático 08:36 con E2E websocket |

## Estado de la escalera de certificación

30 min ✅ (SGP) → 45 min ✅ reserva → 2 h datos✅/métricas❌marginal → 6 h autoría✅ →
**PIVOTE** → Tokio 30 min 🔴 en curso → 2h → 6h → 24h → Parquet → **7 DÍAS**

## Decisiones vigentes del operador
1. Certificar en Tokio (no seguir certificando Singapur)
2. Apagar Singapur solo tras certificación de Tokio y con orden expresa (libera cuota → ampliar Tokio)
3. Producción automática, purga CSV y Cloud Storage: prohibidos hasta orden
4. Meta: 5 meses de trabajo intenso; fases 0→4 con simulación obligatoria antes de dinero real

## Lecciones operativas del día
- "Flake" nunca es causa raíz: los timeouts de 120 s exactos eran configuración, no azar
- El revisor no confía en el autor: el defecto de las continuaciones de línea pasaba pruebas de contenido
- Al clonar VMs: limpiar credenciales de agentes ANTES de crear la imagen
- Cuotas de GCP se verifican ANTES de crear recursos (CPUS_ALL_REGIONS=12)
- El "borde cercano" de un CDN engaña: medir petición completa, no conexión
