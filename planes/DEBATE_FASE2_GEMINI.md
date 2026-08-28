# Debate técnico sobre la fase 2: qué predecir y con qué

**Fecha:** 28/08/2026, 05:30 UTC
**Participantes:** Claude (revisor) y Gemini, sobre datos medidos de la VM.
**Encargo del operador:** *"conversa con Gemini un plan para avanzar hacia el
objetivo"*.

---

## 0. Por qué este debate importa más que el código

Todo lo construido hasta ahora —captura certificada, compresión, respaldos— es
**infraestructura**. Sirve para tener datos limpios. Pero un dato limpio no vale
nada si se le hace la pregunta equivocada.

Las decisiones de esta página no se pueden corregir después sin repetir la
captura de 7 días. Por eso se discuten **antes**.

---

## 1. Las cuatro tesis que puse a debate, y cómo salieron

### Tesis 1 — "Spot y futuros sincronizados es nuestro activo más valioso"
**Estado: PARCIALMENTE REFUTADA.**

Mi argumento: tenemos ambos mercados con secuencia causal común, lo que permite
medir el adelanto-retraso entre libros a escala de milisegundos.

La objeción de Gemini, y es correcta:

> *Spot y Futuros USD-M son sistemas distribuidos independientes, con motores de
> emparejamiento físicos distintos, relojes desalineados y buffers de publicación
> desacoplados. Lo que llamas "adelanto-retraso" es la convolución de la dinámica
> real del flujo con el **jitter de dos pasarelas WebSocket distintas**.*

Y remata con el argumento de escala: la profundidad llega en cubos de **100 ms**.
A esa cadencia el arbitraje ya lo hicieron firmas con C++ en AWS Tokio a menos de
1 ms. **No vamos a arbitrar a los HFT.**

**Lo que sobrevive:** la comparación entre mercados sigue valiendo, pero como
**desequilibrio de flujo conjunto**, no como carrera de latencia. La diferencia
no es semántica: cambia por completo qué característica se calcula.

### Tesis 2 — "Los indicadores clásicos son ruido a esta escala"
**Estado: PARCIALMENTE REFUTADA.**

Tenía razón en que los osciladores a 100 ms no sirven. Pero cometí un error de
escala al descartar todo lo macro:

> *Si ignoras el régimen de volatilidad, el modelo interpretará un desequilibrio
> de 20 BTC en el nivel 5 de la misma forma en plena cascada que en un rango
> muerto de domingo asiático.*

**Corrección:** las variables de régimen (volatilidad realizada en ventanas de
1 y 5 min, velocidad acumulada del flujo) son **obligatorias**, no para predecir
sino para **normalizar** las métricas de microestructura.

Y un aviso que yo no había considerado: el libro a 100 ms está dominado por
**spoofing y cancelaciones de market makers**. La "duración de una orden en la
cola" a menudo mide un bot retirando su propia liquidez, no intención real.

### Tesis 3 — "7 días son pocos datos; el riesgo es el sobreajuste"
**Estado: CONFIRMADA, y reformulada mejor.**

> *No son "pocos datos": son **un único régimen de mercado**. Si durante esos 7
> días BTC sube un 4 % con baja volatilidad, tu modelo no habrá visto jamás un
> barrido de liquidaciones en cascada de −8 % en 3 minutos.*

Esa formulación es superior a la mía. Yo hablaba de autocorrelación —cierto:
~10⁴ muestras independientes en vez de 6×10⁶—, pero el problema mayor es el
**sesgo de muestra condicional a la volatilidad de esa semana concreta**.

Un modelo entrenado así **muere en el primer evento no estacionario**.

### Tesis 4 — "La partición debe ser temporal, con embargo"
**Estado: CONFIRMADA, con una corrección importante.**

Yo proponía un embargo del tamaño del horizonte de predicción. Insuficiente:

> *El leakage ocurre hacia atrás y hacia adelante. Si usas una ventana de 30 s
> para normalizar una variable y un horizonte de 5 s, el embargo mínimo debe ser
> de **35 s**.*

**Regla corregida:**
`embargo = max(ventana de lookback de las características) + horizonte de predicción`

---

## 2. La etiqueta: qué predecimos exactamente

**Decisión: triple barrera con retorno NETO de costes.**

```
                    +----------------------+  Barrera superior: +k·σ_local
                    |     trayectoria      |
   Mid en t0 -------+----------------------+
                    |                      |
                    +----------------------+  Barrera inferior: -k·σ_local
                    |<--- T_max = 10 s --->|  Barrera temporal
```

Las barreras de precio son **proporcionales a la volatilidad local**, no fijas.

### Por qué se descartan las otras

**Retorno a horizonte fijo — la peor.** El mercado no se mueve en tiempo de
reloj sino en tiempo de eventos. Predecir el precio dentro de 1 s obliga al
modelo a predecir ruido cuando está plano, y no ve si durante ese segundo el
precio tocó un stop ruinoso antes de volver.

**Triple barrera sin costes.** Genera señales que compran con un desequilibrio
pero pagan el cruce del libro más la comisión de taker. *"Sharpe teórico de 4.0
en backtest, quiebra inmediata en real."*

### Las tres clases

- **+1** — toca la barrera superior primero **Y** el PnL neto de comisiones y
  deslizamiento supera un umbral positivo
- **−1** — lo simétrico en corto
- **0** — salta la barrera temporal sin cubrir costes, o el spread se lo come

**Horizonte: 10 segundos.** Por debajo de 1 s se compite contra latencia de
hardware; por encima de 1 min el libro pierde poder predictivo.

---

## 3. El techo realista, sin adornos

| | Veredicto |
|---|---|
| **Sí hay señal para** | optimizar ejecución, scalping condicional, market making |
| **No hay señal para** | un predictor direccional que gane 20 pb por operación en horizontes de horas |

Y sobre la capacidad del modelo:

> *No intentes entrenar aprendizaje profundo masivo. **Sobreajustará en minutos
> memorizando las ballenas de esos 7 días concretos.***

**Lo que sí:** modelos lineales con regularización fuerte, o árboles poco
profundos (`max_depth` 3-5, submuestreo agresivo). Y modelos de **ejecución**:
predecir si una orden pasiva en el nivel 1 o 2 se ejecutará o será cancelada por
selección adversa.

---

## 4. 🔴 Lo que falta capturar — decidir ANTES de los 7 días

Éste es el punto que no admite demora: añadir un flujo ahora cuesta horas;
añadirlo después cuesta **repetir la captura entera**.

### 4.1 Liquidaciones forzadas (`<symbol>@forceOrder`) — CRÍTICO

> *Las cascadas de liquidaciones mueven el mercado a corto plazo más que
> cualquier flujo orgánico. Si tu modelo no sabe que ese trade fue una orden
> forzada, atribuirá el movimiento a una "decisión informada" y **sobreajustará
> patrones erróneos**.*

Es el argumento más fuerte de todo el debate. Sin este flujo, el modelo aprende
una explicación falsa de los movimientos más violentos del período.

### 4.2 Precio de marca y financiación (`markPriceUpdate`)

El motor de liquidación de Binance usa el **precio de marca**, no el último
precio. Sin él no se sabe a qué distancia está el libro de los grupos de
liquidación.

### 4.3 Interés abierto

Permite saber si el volumen agresivo **abre posiciones nuevas** o cierra las
existentes. Es la diferencia entre convicción y capitulación.

---

## 5. Características a construir (calculables con lo que ya capturamos)

| | Qué mide |
|---|---|
| **OFI cruzado diferencial** | `OFI_futuros − α·OFI_spot`. Cuando se desvía más de 2σ, futuros empuja sin confirmación de spot |
| **Velocidad de agotamiento** | volumen de trades del último segundo dividido por la profundidad visible de los 5 primeros niveles. Si supera 1.0, el muro se rompe en 100-200 ms |
| **Choque de base** | z-score de `Mid_futuros − Mid_spot` sobre 60 s, más su derivada. Un choque con el libro de futuros adelgazando precede a liquidaciones |
| **Jitter de latencia** | `T_local − E_exchange` y su derivada. Cuando el motor de Binance se satura, esta diferencia sube: indica régimen de saturación y alta probabilidad de deslizamiento |

La última es elegante: convierte en señal algo que ya medimos por otra razón.

---

## 6. Qué cambia en el plan

| Antes | Ahora |
|---|---|
| Lanzar 7 días cuando el gate de 24 h certifique | **Lanzar 7 días sólo tras añadir `forceOrder`** |
| 14 características por definir | Añadir OFI cruzado, velocidad de agotamiento, choque de base, jitter |
| Modelo por decidir | Árboles poco profundos regularizados. **Nada de redes profundas** |
| Etiqueta por decidir | **Triple barrera neta de costes, T_max = 10 s** |
| Embargo = horizonte | **Embargo = lookback + horizonte** |
| Objetivo: predictor direccional | **Objetivo: alfa de microestructura y ejecución** |

Ese último cambio es el más importante y el menos vistoso: **redefine el éxito**
del proyecto en algo alcanzable con los datos que vamos a tener.
