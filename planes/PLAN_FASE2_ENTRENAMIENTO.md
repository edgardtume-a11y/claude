# PLAN FASE 2 — Entrenar el modelo con los datos certificados

## La idea correcta (y el error a evitar)
El modelo de trading NO es un chatbot tipo LLM. Es un modelo de PREDICCIÓN DE MICROESTRUCTURA:
mira los últimos segundos/minutos del mercado y estima qué pasará en los próximos segundos.
Error clásico del principiante: empezar con redes neuronales gigantes. Camino correcto:
empezar SIMPLE y escalar solo si los datos lo piden.

## Escalera de modelos (en orden)
1. **LightGBM / XGBoost** (árboles potenciados) — el caballo de batalla de los quants.
   Entrena en CPU (¡sirve la propia VM n2!), en minutos, e interpreta qué señales importan.
2. **Red pequeña (LSTM/GRU o Transformer chico)** — solo si los árboles muestran que hay señal.
   Aquí entra la RTX 3050 (6 GB VRAM): suficiente para modelos de secuencia de este tamaño.
3. Ensambles / modelos por régimen — fase avanzada.

## El pipeline de datos (el 80% del trabajo real)
CSV/Parquet certificado → FEATURES → LABELS → SPLITS → entrenamiento → backtest
- **Features** (señales de entrada, calculadas por ventana de tiempo):
  mid-price y su retorno, spread, imbalance del libro (bid vs ask), flujo de trades
  (compras vs ventas agresivas), volatilidad rodante, profundidad a N niveles.
- **Labels** (lo que se predice): retorno futuro a 1s/5s/30s, o método triple-barrera
  (¿toca primero +X%, -X% o expira?).
- **Splits SIEMPRE por tiempo** (entrenar con julio, validar con agosto) — JAMÁS mezclar
  al azar: el modelo "vería el futuro" y daría resultados falsos espectaculares (leakage).
- Walk-forward: reentrenar periódicamente y evaluar solo sobre lo que sigue.

## Métricas que importan (y las que no)
- NO importa la "precisión" a secas.
- SÍ importan: PnL simulado DESPUÉS de comisiones y slippage, Sharpe, drawdown máximo,
  y tasa de acierto condicionada a que el modelo dé señal.
- El simulador debe usar la latencia real medida (2 ms) y las comisiones reales de Binance.

## Enemigos mortales
1. **Leakage** (usar información del futuro sin darse cuenta) → resultados falsos.
2. **Overfitting** (memorizar el pasado) → muere en vivo.
3. **Comisiones y slippage** → estrategias "ganadoras" que pierden al restar costos.
4. **No estacionariedad** → el mercado de agosto no es el de octubre; por eso walk-forward.

## Hardware: qué usar para qué
| Tarea | Dónde |
|---|---|
| Features + LightGBM | VM n2 de Tokio (CPU, ya pagada) |
| Redes pequeñas | Tu PC (RTX 3050 6GB) — gratis |
| Redes grandes (si algún día) | GPU cloud por horas (alquiler puntual, no 24/7) |

## Preparación DESDE YA (mientras se certifica la captura)
1. Terminar la escalera de captura hasta 7 días + Parquet certificado (en curso).
2. Definir el "contrato de features" (documento: qué señales, qué ventanas, qué labels)
   — lo redactamos juntos y queda en el repo ANTES de escribir código.
3. Construir el pipeline de features vía flujo Gemini (contrato → autor → revisor),
   con pruebas de no-leakage incluidas en la suite.
4. En tu PC: instalar Python + LightGBM + PyTorch (te guío cuando toque).
5. Aprender los 4 conceptos clave (30 min c/u en YouTube): leakage, walk-forward,
   triple-barrera, Sharpe. Con eso entiendes todas las decisiones que tomaremos.

## Regla de oro de la Fase 2→3
Ningún modelo pasa a la fase 3 (bot) sin: backtest walk-forward positivo DESPUÉS de
costos + simulación en vivo (paper trading) durante días. Dinero real solo tras ambos.
