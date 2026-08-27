# CONTRATO DE FEATURES v1 — Qué verá el modelo (borrador para aprobación del operador)

Fuente única: datos certificados por gates (CSV/Parquet de binance_collector v2.4.1).
Regla madre: UNA sola implementación de features compartida entre entrenamiento e
inferencia en vivo, versionada en el repo. Cambiar una feature = nueva versión = re-entrenar.

## Señales de entrada (features) — todas por ventana rodante
### Del libro de órdenes (la materia prima Bookmap/DOM)
1. mid_price y su retorno log (1s, 5s, 30s)
2. spread absoluto y relativo
3. imbalance_L1 = (bid_vol - ask_vol) / (bid_vol + ask_vol) en el mejor nivel
4. imbalance_L5, imbalance_L10 (profundidad acumulada a 5 y 10 niveles)
5. pendiente del libro (cómo decae el volumen al alejarse del mid)
6. vida media de las órdenes en el mejor nivel (churn del libro)

### Del flujo de trades (order flow)
7. delta de volumen agresor (compras - ventas) por ventana (1s, 5s, 30s)
8. tasa de llegada de trades (trades/segundo)
9. tamaño medio y máximo de trade por ventana
10. racha de agresión (N trades seguidos del mismo lado)

### De contexto
11. volatilidad realizada rodante (30s, 5min)
12. rango high-low de la ventana
13. hora del día codificada seno/coseno (sesiones asiática/europea/americana)
14. spot vs futuros: basis (diferencia de mid entre ambos mercados) — ventaja de grabar los dos

## Labels (lo que se predice) — v1
- L1: retorno del mid a +5s y +30s (regresión)
- L2: triple-barrera a 60s: ¿toca primero +8 pb, -8 pb, o expira? (clasificación 3 clases)
- (los umbrales exactos se calibran con los datos reales del gate de 7 días)

## Reglas anti-leakage (INNEGOCIABLES — van como pruebas pytest en la suite)
1. Toda feature en el tiempo t usa SOLO información con receive_time <= t.
2. Splits SIEMPRE cronológicos; entre train y test se PURGA una zona (>= horizonte del label)
   y se aplica EMBARGO para que ninguna ventana se solape.
3. Normalización calculada SOLO con el train y congelada (jamás con el futuro).
4. Los relojes: siempre receive_time_utc_ns (el nuestro), nunca el del exchange para ordenar.

## Proceso
- Este contrato lo aprueba el operador → Gemini implementa el pipeline bajo contrato
  (archivos autorizados, pruebas anti-leakage incluidas) → revisión independiente → registro.
- Motor v1: LightGBM (protocolo jean-flow-555). Métrica de aceptación: PnL simulado tras
  comisiones en walk-forward, no accuracy.
