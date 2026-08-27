# CONTRATO DE MEJORA — Optimización de colas internas p99 (listo para ejecutar tras el gate 3)

Origen: auditoría técnica cruzada Claude + Gemini (27/08/2026). Objetivo: que las métricas
internas p99 (book_pipeline, writer_yield, book_apply) queden bajo el límite de 5,0 ms
SIN alterar el comportamiento funcional ni el formato de los datos.

## PRERREQUISITO INNEGOCIABLE
No aplicar mientras haya captura activa. El gate 3 (2 h) en curso es la LÍNEA BASE de
comparación: sin él no hay A/B válido.

## Las tres mejoras (independientes, aplicables por separado)

### M1 — Domar el recolector de basura (mayor retorno / menor riesgo)
Problema: CPython pausa el hilo para recolectar objetos temporales creados al parsear JSON
y deltas; esas micro-pausas caen dentro de ventanas de ráfaga y disparan el p99.
Cambio propuesto: al iniciar el proceso de captura, elevar umbrales
`gc.set_threshold(50_000, 50, 50)` (NO `gc.disable()`: riesgo de crecimiento de memoria en
corridas de 7 días) y, opcionalmente, `gc.freeze()` tras la inicialización para sacar los
objetos de arranque de las generaciones jóvenes.
Riesgo: mayor uso de RAM (hay 31 GB, se usa ~1). Reversible borrando 2 líneas.
Verificación: RSS del proceso al final del gate < 4 GB y p99 de métricas mejorado.

### M2 — Yield cooperativo troceado en el writer (ataca el fallo directo)
Problema (diagnóstico de Gemini): "vaciado monopolístico de la cola" — el escritor consume
la ráfaga completa sin devolver control al event loop, y el medidor writer_yield lo delata.
Cambio propuesto: procesar en bloques acotados (p. ej. 50 items o cuota de 1 ms) e intercalar
`await asyncio.sleep(0)` obligatorio entre bloques.
Riesgo: bajo; puede reducir marginalmente el throughput máximo (hay margen de sobra: load 0,2).
Verificación: writer_yield_p99 < 5,0 ms en ambos mercados; 0 pérdidas; journal PASS.

### M3 — uvloop + afinidad de CPU (afinación fina)
Cambio propuesto: `uvloop` como event loop (implementación en C, 2-4× más rápido en E/S) y
fijar el proceso a núcleos físicos con `os.sched_setaffinity` para eliminar migraciones.
Riesgo: uvloop es dependencia nueva → debe entrar con su propia verificación de compatibilidad
con websockets/aiohttp; la afinidad es reversible.
Verificación: p99 E2E y varianza menores; suite completa en verde.

## Protocolo de aplicación (flujo JEAN FLOW)
1. Revisor define el contrato de archivos autorizados (solo el módulo de arranque de captura
   y el writer; PROHIBIDO tocar order_book, audit, formatos de salida).
2. Gemini implementa bajo contrato; responde OK o ABORT.
3. Revisión independiente: diff + suite pytest completa + `cat -A` (reglas de forma).
4. **A/B obligatorio**: gate de 30 min ANTES (línea base = gate 3) vs DESPUÉS, misma máquina,
   mismo símbolo. Se comparan: book_apply/book_pipeline/writer_yield p99 y latencia E2E.
5. Si alguna métrica empeora → revertir (git del staging) y registrar el hallazgo.
6. Registro en Notion + memoria GitHub con los números de ambos lados.

## Orden recomendado
M1 y M2 juntas (ambas quirúrgicas, se miden en un solo A/B) → si aún queda margen, M3 aparte.
