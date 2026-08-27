# PENDIENTES — Handoff para cualquier IA (actualizado 27/08/2026 ~15:25 UTC)

Lee primero: memoria/MEMORIA_JORNADA_27AGO2026.md y _PARTE2.md, y el contexto en Notion
(página 19 + Memoria operativa). Vía de trabajo: PUENTE GITHUB (tutoriales/TUTORIAL_PUENTE_GITHUB.md).

## En curso ahora mismo
1. **Gate 3 (2 horas) GRABANDO** en n2-standard-8 dedicada desde 15:05 UTC.
   Staging: /home/trading/jean-flow-exec/staging_runs/20260827T143004Z_tokyo_n2_capture_gate3_2h
   (sesión c37b7c55…). Veredicto programado ~17:13 UTC (trigger Veredicto Gate 3):
   estado → auditorías → return_codes → latencia_e2e → veredicto A/B.
   Pregunta clave: ¿metrics=0 en máquina dedicada? (historial marginal: e2 siempre 5-7 ms vs límite 5,0).
   Si PASA → gate 2h certificado → pedir orden del operador para 6h.
   Si NO PASA → hipótesis hardware refutada → opciones: umbral documentado 6,5 ms vs optimización código vía Gemini (decide operador).
2. **Diálogo del amor** (filosofia/QUE_ES_EL_AMOR.md): ronda 2 enviada a Gemini
   (clave filo-amor-ronda-2). Recoger respuesta (gemini_result), anexarla, contrarreplicar.
   Continúa hasta que el operador diga basta.

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
