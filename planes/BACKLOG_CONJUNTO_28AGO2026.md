# Backlog conjunto Claude · ChatGPT — 28/08/2026

Producto del contraste entre las dos IAs sobre `jean-flow-02-tokyo`, según el
principio del operador: *un cambio agresivo propuesto por una IA se contrasta
con otra hasta converger*.

Columna **evidencia** separa lo medido de lo supuesto. Detalle de las medidas
en `memoria/HALLAZGOS_28AGO2026_INSTRUMENTO_Y_LINAJES.md`.

| # | Prio | Ítem | Evidencia | Riesgo si no se hace | Prueba de aceptación | ¿Orden del operador? |
|---|---|---|---|---|---|---|
| 1 | **P0** | Fuente canónica del código; el overlay se genera desde ahí | Medida: 3 huellas, 1 versión; el linaje bueno solo vivía en staging | Pérdida total del código de producción al purgar staging | Dos builds del mismo commit dan el mismo árbol; el gate se niega a arrancar si el overlay está alterado; la purga de staging no alcanza a source ni releases | **Sí** |
| 2 | **P0** | Identificador real de versión en cada línea de métricas | Medida: las 3 copias dicen `2.4.1+linux.1` | Ninguna medición pasada es atribuible a un código concreto | Reprocesar un gate y poder decir qué huella lo generó | Sí (toca motor) |
| 3 | **P0** | Doble reloj en la sonda; solo el wall decide PASS/FAIL, tras validar A/A | Medida: uvloop da 1 valor distinto en 2000 lecturas | Todo A/B con uvloop mide tratamiento + instrumento | Gate corto donde las dos series difieran de forma cuantificada | Sí (toca motor) |
| 4 | **P0** | Guardián: prohibir que una orden reinicie su propio servicio; ACK durable | Medida: incidente del 28/08, 5 ciclos en 2 s, 29 min ciego | Repetición del bucle; el puente es la vía de trabajo | Inyectar `acelerar-001` en un banco y ver que no hace bucle | Sí |
| 5 | P1 | Observabilidad causal: `gc.callbacks` con duración, duración de `fsync`, de snapshot REST y de publicación; profundidad de colas | Inferencia: bimodalidad p95≈2 ms / max 45.7 ms sin contador que la acompañe | No se puede identificar el suceso raro | Banco de sobrecoste < 1 % antes de instalarla | Sí (toca motor) |
| 6 | P1 | Variables del host alineadas a las ventanas: CPU, run queue, steal, iowait, cambios de contexto | Medida: `jean_flow_metrics.jsonl` no tiene ni una variable del host | No se separa saturación interna de presión del anfitrión | Un gate con la serie del host alineada a 5 s | Sí |
| 7 | P1 | Integridad del puente Git: exclusión mutua; prohibir `reset --hard` con trabajo local | Medida: `puente_github_watcher.py:224` hace `reset --hard` en cada ciclo | Pérdida silenciosa de cambios locales rastreados | Dejar un cambio local y ver que el guardián se niega en vez de borrarlo | Sí |
| 8 | P1 | Modelo de estados único (`accepted/started/completed/failed/cancelled`) en guardián, router y agente | Lectura: el agente da `ok`/`returncode`; el guardián `{ok,error,procesado_utc}`. Contratos distintos | Estado ambiguo tras un fallo | Los tres componentes reportan el mismo vocabulario | Sí |
| 9 | P2 | Estudio de eventos sobre lo grabado: primeras diferencias, ventanas −2..+2, emparejado, permutación por bloques, FDR por familias | Diseño de ChatGPT; los deciles de Claude como exploración previa | Ninguno — es análisis | Que el resultado repita en gate 3 y gate 4 | **No** (solo lectura) |
| 10 | P2 | Banco de replay con cadencia preservada y carga controlada | La profundidad es un metrónomo (CV 0.01), reproducible; los trades son la parte variable (CV 1.28) | Sin variación de dosis controlada no hay causalidad | Que el replay reproduzca el histograma de llegadas del gate 3 | Sí |
| 11 | P2 | Ownership/lock por recurso (dos IAs sobre la misma máquina) | Hoy se evita por convención, no por mecanismo | Edición simultánea del mismo archivo | Dos escritores concurrentes y uno falla limpio | Sí |
| ~~12~~ | — | ~~Separar procesos por mercado~~ | Medida: la profundidad da 1.00 en el decil alto; los trades 1.6× y Spearman +0.235 | — | — | **Eliminado** — era propuesta de Claude y no tiene apoyo |

## Gates de decisión (ChatGPT)

No avanzar de fase si ocurre cualquiera:

- Runtime/hash no atribuible
- Diferencia no explicada entre source, release y overlay
- El sobrecoste de observabilidad supera el presupuesto
- Métrica wall y auditor sin contrato definido
- El guardián puede repetir una orden no idempotente
- Producción, purga o Cloud Storage se activan sin autorización

## Estado al 28/08/2026 07:10 UTC

| ítem | estado |
|---|---|
| 1 (preservación) | **hecho a medias**: 79 ficheros sellados en `/home/trading/codigo_canonico/` (solo lectura, integridad verificada). Falta el builder y la promoción — decisión del operador |
| 2 (identificador) | **programado** en la fuente candidata, sin promover |
| 3 (doble reloj) | **programado y probado** en la fuente candidata, sin promover |
| 4 (guardián) | **hecho y en producción**: `puente_github_watcher.py` `11f33eb7` → `7b73fcd2` |
| resto | pendientes de orden |
