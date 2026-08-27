# FLUJO DE ALMACENAMIENTO — CSV para capturar, Parquet para archivar
Decisión de diseño acordada con el operador el 27/08/2026. Estándar de la industria
("write hot, store cold") adaptado a las reglas de JEAN FLOW.

## El flujo

```
Binance  →  CSV (escritura en vivo, línea por línea)
                 │
                 ├─ archivo cerrado (rotación por hora/tamaño)
                 ▼
            CONVERSOR: CSV → Parquet (zstd)
                 │
                 ├─ VERIFICACIÓN: releer el Parquet y comparar fila por fila
                 │  contra el CSV (igualdad de tabla + hash). Si NO coincide → ABORTA,
                 │  conserva el CSV, registra el incidente. Nunca se borra a ciegas.
                 ▼
            Parquet certificado  →  fuente para entrenamiento y respaldos
                 │
                 └─ CSV original: se CONSERVA por defecto.
                    Su borrado requiere (a) verificación exitosa previa y
                    (b) ORDEN EXPRESA del operador. La purga automática sigue PROHIBIDA.
```

## Por qué no se escribe directo en Parquet
Parquet es columnar: necesita acumular bloques (row groups) en memoria antes de escribir.
Retener datos en memoria es exactamente lo que un colector de baja latencia NO debe hacer
(añade jitter y riesgo de pérdida ante caída). El CSV se escribe append-only, al instante,
sin estado retenido — es el formato correcto para la ruta caliente. Parquet entra cuando el
archivo ya está cerrado y nadie lo escribe: ahí comprime sin costar latencia.

## Por qué sí se archiva en Parquet (medido con datos propios el 27/08/2026)
| | CSV crudo | Parquet + zstd |
|---|---|---|
| 50.001 filas reales (usdm_futures) | 19.822.897 bytes | 275.579 bytes |
| Factor | — | **71,93×** |
| 1 día de captura (estimado) | ~54 GB | **~750 MB** |
| 7 días (estimado) | ~380 GB (no cabe) | **~5 GB** (cabe de sobra) |
Verificación de la prueba: `tabla.equals(tabla2) == True` tras el viaje de ida y vuelta.
**Misma data, distinto empaque. Cero pérdida.**

## Beneficio extra para la Fase 2
Al ser columnar, el entrenamiento puede leer SOLO las columnas que necesita (p. ej. precios
y tamaños) sin tocar el resto del archivo → menos E/S y menos RAM al construir features.

## Estado actual y plan de activación
- HOY: el grabador escribe CSV (formato certificado por todas las auditorías). Parquet está
  PROBADO pero NO activado; por eso el disco sigue creciendo al ritmo del CSV.
- El motor ya incluye `parquet_store.py` (641 líneas): **no hay que construirlo, hay que
  certificarlo y encenderlo.**
- Requisito: Parquet activo y certificado ANTES del gate de 24 h (sin él, 7 días no caben).
- Camino: contrato → Gemini implementa el conversor con verificación → revisión independiente
  (pytest + prueba de igualdad sobre datos reales) → gate con Parquet activo → registro.

## Regla permanente
Los CSV certificados siguen siendo la fuente de verdad notarial. Parquet es la capa de
archivo y análisis. Ningún borrado sin verificación previa Y orden expresa del operador.
