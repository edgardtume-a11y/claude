# EVALUACIÓN — ArcticDB vs Parquet para la fase de entrenamiento (LightGBM)

## Veredicto corto
**HOY: Parquet + Polars. ArcticDB: cuando llegue el multi-símbolo (memecoins).**
LightGBM es neutral: consume tablas en memoria; cualquiera de las dos despensas lo alimenta.

## Comparación honesta
| Criterio | Parquet (actual) | ArcticDB (Man Group) |
|---|---|---|
| Compresión | 72x verificado con NUESTROS datos | Similar (comprime parecido) |
| Simplicidad | Archivo plano, cero servicios nuevos | Librería + almacén propio (S3/LMDB) |
| Lectura para entrenar | Polars lo devora; sobra para 1 símbolo | Brilla con MILES de símbolos y consultas por rango |
| Versionado de datasets | Manual (carpetas/nombres) | NATIVO: "snapshot" de cada dataset, viajar en el tiempo |
| Actualización incremental | Reescribir/añadir archivos | Nativa (append eficiente por símbolo) |
| Riesgo operativo | Cero (ya certificado en el flujo) | Nueva pieza que aprender/certificar |
| Costo | 0 | 0 (open source) |

## Cuándo cambia la balanza
ArcticDB gana cuando: (a) grabemos 10-100 memecoins en paralelo, (b) queramos versionar
datasets de entrenamiento ("el modelo X se entrenó con el snapshot Y" — auditoría de ML),
(c) consultas del tipo "dame el libro de PEPE entre las 14:00 y 14:05 de hace 3 semanas".
Ese es exactamente el mundo memecoin. Por eso: candidata OFICIAL para la fase multi-símbolo.

## Decisión propuesta
1. Fase 2 v1 (BTCUSDT): Parquet + Polars + LightGBM. Sin piezas nuevas.
2. Al activar multi-símbolo: gate propio de ArcticDB (mismo estándar: ida-y-vuelta
   verificada fila a fila contra el CSV certificado antes de confiarle nada).
3. Los CSV crudos certificados siguen siendo la fuente de verdad notarial en ambos casos.
