# PENDIENTES — Handoff para cualquier IA (actualizado 27/08/2026 ~21:20 UTC)

Lee primero: memoria/MEMORIA_JORNADA_27AGO2026.md y _PARTE2.md, y el contexto en Notion
(página 19 + Memoria operativa). Vía de trabajo: PUENTE GITHUB (tutoriales/TUTORIAL_PUENTE_GITHUB.md).

## En curso ahora mismo
1. **Gate 3 y gate 4 CERRADOS.** Nada grabando. La máquina está libre.
   - Gate 3 (4 h 45, sin uvloop): 3/4 auditorías PASS, **metrics FALLA** por
     `usdm.book_apply` 6.282 ms y `usdm.book_pipeline_total` 7.399 ms (límite 5.0).
     Identidad perfecta: 1 432 500/1 432 500, ratio 1.0, 0 conflictos.
     Staging: `.../20260827T143004Z_tokyo_n2_capture_gate3_2h` (sesión c37b7c55…), 18 GB.
   - Gate 4 (30 min, CON uvloop + `gc.freeze`): **4/4 auditorías PASS**, primera vez
     que `metrics` certifica. Identidad 89 767/89 767, ratio 1.0, cierre rc=0, 0 parciales.
     Staging: `.../20260827T195636Z_tokyo_n2_gate4_mejoras_30m` (sesión f4349129…), 1.1 GB.
   - Veredicto completo: `operaciones/VEREDICTO_AB_GATE4.md`. **El cambio se conserva.**

2. **Diálogo del amor** (`filosofia/QUE_ES_EL_AMOR.md`): la ronda 2 de Claude está
   escrita y publicada; **falta recoger la respuesta de Gemini** (job en
   `puente_github/resultados/filo-amor-r2.json`), anexarla y contrarreplicar.
   Continúa hasta que el operador diga basta.

## ⛔ BLOQUEADOR NUEVO — decidir antes del gate de 24 h
3. **El disco no aguanta los 7 días.** Medido: 3.74 GiB/h.
   7 días = **628 GiB**; libres = **120 GiB**. La captura moriría a las ~32 h.
   El gate de 24 h (89.8 GiB) dejaría el disco al 97 %.
   Con Parquet: 628 GiB → **8.74 GiB**. Tres salidas evaluadas con coste en
   `planes/BLOQUEADOR_DISCO_7DIAS.md`. **Requiere decisión del operador.**

## Hallazgos que cambian el plan
4. **Dos de las tres mejoras de la auditoría cruzada YA existían** en el código
   (`planes/AUDITORIA_MEJORAS_CORREGIDA.md`):
   - M1 (umbrales del GC): ya estaba en `latency.py`, con `(50000, 100, 100)` y
     `sys.setswitchinterval(0.001)`. Solo faltaba `gc.freeze()` — ya añadido.
   - M2 (troceo del writer): ya estaba, con 64 filas. Y su otra mitad es
     **inaplicable**: el writer es `threading.Thread`, no una tarea asyncio.
     **M2 ANULADA.**
   - M3 (uvloop): era la única real. Aplicada y verificada.
   Lección: una auditoría hecha sin leer el código produce recomendaciones
   plausibles y falsas. El revisor debe leer el archivo ANTES de encargar.

5. **`event_loop_lag` es la próxima grieta.** Peor p99: 19.8 ms (gate 3) → 19.0 ms
   (gate 4), contra un límite de auditoría de 20 ms. uvloop apenas lo movió (−4 %,
   frente a −23/−29 % de las demás). **Pasa con un 5 % de margen.** En un gate de
   24 h es lo primero que va a romper. Falta entender de dónde salen esos 19 ms.

6. **El A/B secuencial no puede demostrar causalidad.** El gate 4 corrió con el
   mercado un 32-44 % más flojo (aunque `depth_diff_messages` —el caudal que
   gobierna las métricas que mejoraron— fue idéntico al 0.1 %). Indicio fuerte,
   no prueba. La prueba concluyente es la de Gemini: **dos procesos en paralelo
   sobre el mismo flujo, misma hora, 48 h**. Requiere orden del operador y
   resolver antes el bloqueador de disco (dos capturas de 48 h ≈ 360 GiB).

## Después del veredicto del gate 3
3. **Respaldo total** (orden del operador): ejecutar puente_github/scripts/respaldo_total.sh
   vía ejecutar_script_repo (tiene guarda anti-captura-activa). Genera
   /home/trading/respaldo_jean_flow_<TS>.tar.gz. Luego guiar al operador para descargarlo:
   WinSCP (necesita llave SSH en su Windows — guiarlo paso a paso) o botón Descargar del SSH del navegador.
4. **Parquet conversor definitivo** vía flujo Gemini (etapa 1 aprobada: pyarrow 25.0.1,
   ida-y-vuelta idéntica, compresión 71,9×). Contrato: convertir staging completo,
   verificación fila a fila, JAMÁS borrar CSV originales sin orden expresa.
5. **Escalera**: 6h → Parquet certificado → 24h → 7 días. NINGÚN lanzamiento sin orden del operador.

## Tareas menores pendientes
6. Copiar a Notion cuando reviva: manual puerta universal, bloques 16R/16S en página 19
   (id 3c9c3f63-ec67-810c-9377-cb3387a73fe4), filas en Memoria operativa
   (collection 73f962a0-c400-4a0d-a637-c7485ae6b935; Etiquetas válidas: sistema/contexto/decisión/pendiente/fuente/handoff/plantilla; Tipo válidos: Contexto actual/Decisión/Pendiente/Fuente/Hallazgo/Handoff).
7. Recordar al operador: recortar permisos del PAT puente-tokio a solo Contents RW (quedó amplio).
8. El operador generará una infografía del nuevo flujo con IA de imágenes (prompt ya entregado);
   cuando la comparta, subirla a GitHub (entregables/) y a Notion.
9. Renovación del PAT (expiración ~30-90 días desde 27/08) — procedimiento en el tutorial.
10. Idea de negocio del operador pendiente de responder desde temprano: "¿puedo crear mi
    empresa de alquilar un VPS con mi código para que las empresas graben sus datos?" — darle
    una respuesta seria de viabilidad cuando haya un momento tranquilo.

## Reglas que nunca cambian
- Producción automática, purga de CSV y Cloud Storage: PROHIBIDOS sin orden expresa.
- Un solo orquestador por tarea. Claves idempotentes en toda orden.
- Todo cambio de código: contrato → Gemini → revisión independiente → registro.
- Secretos jamás en GitHub/Notion/chats.

## Notas del operador (volcado 27/08 ~15:45 UTC)
- **Marca candidata**: QUANTFLOW / Lorvellan Flow / Lorvellan Fund (por decidir).
- **Verificado hoy**: el sistema SÍ captura el libro de órdenes completo (la auditoría journal
  lo reconstruye tick a tick con resultado 0) — es la misma materia prima de Bookmap/ATAS/
  ExoCharts/Volume Profile/DOM. La visualización sería con herramientas aparte, no bloqueante.
- **Túnel Cloudflare + puente UNRESTRICTED**: se CONSERVAN — son la puerta HTTPS universal (vía #1).
- **ArcticDB** (open source de Man Group): candidata para la capa de datos de ENTRENAMIENTO
  (complemento/alternativa a Parquet en fase 2). Evaluar cuando toque el pipeline de features.
- **Futuro lejano**: migrar a AWS Tokio (misma nube que Binance) → sub-milisegundo. Anotado en plan ultra.
- **Memecoins multi-símbolo**: diseño ya registrado (N streams, grabar también perdedoras,
  Parquet prerrequisito, ventana deslizante 4-8 semanas). Después de certificar BTC.
- **Fase 4 (bot)**: "baja frecuencia casera" — candidatos Nautilus Trader (serio) / Freqtrade (fácil),
  Binance Testnet para paper trading, kill switch + API keys sin permiso de retiro.
- **Principio del operador**: cambio agresivo propuesto por una IA se contrasta con otra IA
  hasta converger — pilar del sistema de orquestación.
- **Proyecto aparte** (otra sesión/repo): plataforma de cursos de Derecho como plantilla
  reutilizable para toda la carrera — el operador quiere construirla con Claude.
- **Pendiente delicado (usuario, no urgente)**: cambio de correo en la facturación de Google
  (quitar el de Edgard) — hacerlo con cuidado: primero agregar el nuevo administrador,
  verificar, recién quitar el viejo. NO tocar durante certificaciones.
- Lista de permisos allowlist para sesiones Claude ya registrada en settings (RDC lectura+proceso, Notion lectura).

## ⭐ SUPER PENDIENTE — Mejoras de latencia y tecnologías (auditoría cruzada 27/08)
Documentos fuente: planes/AUDITORIA_TECNICA_CRUZADA.md y planes/CONTRATO_MEJORA_LATENCIA_V1.md.
Requisito: NO aplicar mientras haya captura activa. El gate 3 es la línea base del A/B.

### Prioridad 1 — Aplicar tras el veredicto del gate 3 (vía flujo Gemini + A/B obligatorio)
1. **M1 domar el GC**: `gc.set_threshold(50_000, 50, 50)` + `gc.freeze()` tras init.
   NUNCA `gc.disable()` (crecimiento de RAM en corridas de 7 días). Verificar RSS < 4 GB.
2. **M2 yield troceado en el writer**: bloques de ~50 items o cuota de 1 ms +
   `await asyncio.sleep(0)` obligatorio entre tandas. Ataca directamente writer_yield_p99.
3. **M3 uvloop + afinidad de CPU**: `uvloop.install()` antes de `asyncio.run()` +
   `os.sched_setaffinity`. Validar con el método de Gemini (dos workers en paralelo, 48 h).

### Prioridad 2 — Tecnologías a incorporar (por fase)
- Fase 1 (colector): **uvloop**, **msgspec** (reemplazo de orjson con structs preasignados).
- Fase 2 (entrenamiento): **Polars** (lectura Parquet columnar multi-hilo), luego **Optuna**.
- Si M1-M3 no bastan: **Cython / PyO3** para las mutaciones del libro L2 (submilisegundos)
  y **jemalloc/mimalloc** contra la fragmentación de heap.
- Multi-símbolo (memecoins): **ArcticDB** con versionado de datasets.
- Fase 4 (bot): **Nautilus Trader** — descartado para el colector, candidato para el ejecutor.
- Opcional/discrepancia registrada: **DuckDB** (Gemini lo ve redundante con Polars+Parquet;
  Claude lo mantiene útil para consultas exploratorias del operador sin programar).

### Prioridad 3 — Respaldo completo v2
Ver planes/PLAN_RESPALDO_COMPLETO.md: estructura de 4 carpetas (proyecto/servicios/
instaladores/RESTAURAR.md) + estrategia de 3 capas (GitHub / .tar.gz / imagen de máquina).

### Prioridad 4 — Costos
planes/PLAN_OPTIMIZACION_COSTOS.md: apagar la VM entre gates ahorra ~70%
(US$ 260/mes → ~US$ 22-87/mes). Postular a Google for Startups. El operador descartó
explícitamente la vía de múltiples cuentas (riesgo de suspensión total).
