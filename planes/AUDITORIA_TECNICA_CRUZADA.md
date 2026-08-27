# AUDITORÍA TÉCNICA CRUZADA Claude ↔ Gemini — 27/08/2026
Método del operador: una IA propone, la otra contrasta, hasta converger. Datos reales medidos.

## PARTE 1 — Diagnóstico de las colas p99

### La cola larga de la latencia E2E (p50 2,05 ms vs p99 23,93 ms)
Hipótesis de Gemini (coincide con la de Claude y la amplía):
1. **Ráfagas del exchange + coalescing TCP**: en picos de volatilidad Binance envía frames
   acumulados; el socket entrega lotes y el loop los procesa en serie.
2. **Pausas del GC de CPython (gen 1/2)**: creación/descarte masivo de dicts al parsear
   JSON y deltas detiene el hilo principal.
3. **Bloqueo del event loop por ráfagas CPU-bound**: `book_apply` acumulado retrasa el `recv`.

### Causa de `writer_yield_p99 > 5 ms` (diagnóstico quirúrgico de Gemini)
**"Vaciado monopolístico de la cola"**: el writer consume la ráfaga completa en un bucle
sin devolver control al event loop (`while not queue.empty()` o serialización de bloques
grandes). Retiene el hilo único e impide atender el socket.
**Corrección sin reescribir el motor**: chunking con yield cooperativo forzado — procesar
un límite fijo (≈50 items o cuota de 1 ms) e intercalar `await asyncio.sleep(0)`.

### launcher.py (2.921 líneas): ¿refactor ahora?
**Acuerdo total: DESPUÉS de certificar.** Orquesta ciclo de vida y configuración; NO está
en la ruta crítica L2. Refactorizar 3k líneas durante la escalera de gates = riesgo alto de
regresiones sin ninguna mejora de p99. Congelado hasta superar el gate de métricas en n2.

## PARTE 2 — Las 3 mejoras priorizadas (retorno/riesgo)
| # | Mejora | Retorno | Riesgo | Detalle |
|---|---|---|---|---|
| M1 | **Domar el GC** | Alto | Mínimo | `gc.set_threshold(50_000, 50, 50)` + `gc.freeze()` tras init. NO `gc.disable()` (crecimiento de RAM en 7 días) |
| M2 | **Yield troceado en el writer** | Alto | Bajo | Bloques acotados + `await asyncio.sleep(0)` obligatorio entre tandas |
| M3 | **uvloop + afinidad de CPU** | Medio | Bajo | Event loop en C (libuv) + `os.sched_setaffinity` para evitar migración entre núcleos |
Contrato de aplicación en planes/CONTRATO_MEJORA_LATENCIA_V1.md (A/B obligatorio).

## PARTE 3 — Tecnologías nuevas: veredicto conjunto
### ADOPTAR YA (acuerdo Claude + Gemini)
- **uvloop** — reemplazo en C del event loop; baja jitter de scheduling ~1-2 ms.
- **Polars** — columnar multi-hilo en Rust sobre Arrow/Parquet; esencial para la fase LightGBM.
- **msgspec** — parsing con validación estricta y structs preasignados; supera a orjson al
  evitar dicts intermedios en payloads L2 masivos.

### POSPONER
- **Optuna** — sí para hiperparámetros de LightGBM, cuando el dataset y features estén consolidados.
- **DuckDB** — Gemini lo ve redundante frente a Polars+Parquet. **Discrepancia registrada**:
  Claude lo mantiene como valioso para consultas exploratorias del OPERADOR (SQL sin programar),
  no como pieza de ingeniería. Decisión: opcional, sin prioridad.
- **ArcticDB** — para multi-símbolo masivo (memecoins) con versionado de datasets.

### DESCARTAR (para el colector)
- **Nautilus Trader** — reescribir el colector certificado dentro de su arquitectura Cython/Rust
  es fricción gigantesca. Nota: sigue siendo candidato para la FASE 4 (bot ejecutor), no aquí.

### Aportes NUEVOS de Gemini (no estaban en la lista de Claude)
1. **Cython / PyO3 (Rust bindings)** — compilar a binario nativo las mutaciones del libro L2
   y el cálculo de depth → `book_pipeline` p99 a submilisegundos. La bala de plata si M1-M3
   no bastan.
2. **Numba** — JIT para operaciones numéricas vectorizadas en la generación de features (fase 2).
3. **jemalloc / mimalloc** — asignadores de memoria de alto rendimiento; mitigan la
   fragmentación por creación/destrucción continua de mensajes WebSocket.

## PARTE 4 — Método de validación A/B propuesto por Gemini (mejor que el secuencial)
Levantar un **segundo worker idéntico** escuchando el mismo flujo de Binance, uno con
`uvloop.install()` y otro sin, y comparar p95/p99 y CPU durante 48 h antes de promover.
Ventaja: cero riesgo para la certificación en curso; evidencia sobre tráfico real simultáneo.
**Adoptado como método estándar para futuras comparaciones de motor.**

## Conclusión de la auditoría
El sistema no tiene defectos de diseño: tiene tres puntos de afinación conocidos y acotados.
Ninguna de las mejoras propuestas requiere reescritura. El orden es: M1+M2 juntas (un A/B),
luego M3, y solo si persiste el margen, evaluar Cython/PyO3 para el hot path del libro.
