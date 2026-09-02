# liquidation-bot

Bot local que escucha los feeds **oficiales** de liquidaciones de varios exchanges
en tiempo real, guarda todo en SQLite, y avisa por Telegram cuando ve:

- una **liquidacion individual grande** (`SINGLE_EVENT_ALERT_USD`), o
- un **"muro"**: varias liquidaciones del mismo lado (longs o shorts),
  concentradas en precio y tiempo, cuya suma cruza `CLUSTER_ALERT_USD` — esto
  es lo que reconstruye, con datos propios y verificables, el tipo de mapa de
  liquidaciones que la gente comparte en Binance Square / Bybit despues de un
  pump.

Este proyecto vive separado de `entregables/` y de las skills `jean-flow-555` /
`quant-dev-senior` de este repo (proyecto distinto, no lo toca).

## Por que no scrapea Binance Square / Bybit directamente

No hay API publica para el contenido social de esas plataformas: habria que
scrapear HTML, es fragil (cambia sin aviso) y probablemente viola sus
terminos de servicio. En cambio, cada exchange SI expone oficialmente su
propio stream de liquidaciones ejecutadas — es el dato de origen que esos
posts terminan graficando. El bot arma su propio mapa desde la fuente,
en vivo.

## Que trae cada alerta

Cada alerta de Telegram no es solo "se liquido tanta plata": junta la
liquidacion con el funding rate (y open interest cuando el exchange lo
expone en bulk) del mismo simbolo, sacado en vivo de la API oficial —
el mismo tipo de contexto que muestran los posts de liquidacion en
Binance Square o un dashboard de CoinGlass, pero generado por el bot
mismo a partir de datos propios, no copiado de ahi.

```
🔥 LIQUIDACION — BINANCE BTCUSDT
🔴 LONG liquidado
💰 $122,000 @ 61000
📊 funding +0.0180%
```

`market_structure.py` refresca esto cada `MARKET_SNAPSHOT_INTERVAL_SECONDS`
(default 5 min) para el top `MARKET_TOP_N` de monedas por volumen
(default 100), en Binance y Bybit.

## Cobertura por exchange

| Exchange | Estado | Como |
|---|---|---|
| Binance Futures | Produccion | Firehose oficial `!forceOrder@arr` (todos los simbolos, un solo stream) |
| Bybit (linear) | Produccion | Topic `liquidation.<symbol>` por simbolo (Bybit no tiene firehose "todos"); si no fijas `SYMBOLS_WHITELIST`, se suscribe solo a los N simbolos con mas turnover 24h (`BYBIT_TOP_N_SYMBOLS`) y se refresca solo |
| OKX | Best-effort | Canal publico `liquidation-orders`. El esquema exacto no esta verificado contra la doc en vivo de OKX (`exchanges/okx.py` tiene el link) — el parser nunca revienta ante un mensaje inesperado, solo lo loguea y sigue |
| Otros (Bitget, KuCoin, ...) | No implementado | Agregar un archivo nuevo en `exchanges/` que implemente `ExchangeConnector` (ver `exchanges/base.py`) y sumarlo en `main.py:_build_connectors` |

## Instalar

```bash
cd liquidation-bot
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Completa `.env`:
1. Cread un bot con [@BotFather](https://t.me/BotFather) en Telegram -> `TELEGRAM_BOT_TOKEN`.
2. Mandale un mensaje a tu bot, despues consulta
   `https://api.telegram.org/bot<TOKEN>/getUpdates` para sacar tu `chat_id`
   (o usa [@userinfobot](https://t.me/userinfobot)) -> `TELEGRAM_CHAT_ID`.
3. Ajusta los umbrales (`SINGLE_EVENT_ALERT_USD`, `CLUSTER_ALERT_USD`, etc.)
   segun que tan seguido queres que te avise.

## Correr

```bash
python3 main.py
```

Queda corriendo hasta Ctrl+C. Cada liquidacion normalizada se guarda en
`liquidations.db` (SQLite) con exchange, simbolo, lado, precio, cantidad,
valor en USD y timestamp UTC — quedan ahi para analizarlas despues (por
ejemplo reconstruir un heatmap historico por simbolo).

## Probar sin red ni Telegram

```bash
PYTHONPATH=. python3 tests/test_aggregator.py
```

Corre la logica de deteccion de umbrales/clusters/cooldown contra eventos
fabricados en memoria — no abre ningun socket.

## Limites conocidos

- Los umbrales de cluster y los cooldowns viven en memoria: un restart del
  bot los reinicia (los datos en `liquidations.db` no se pierden).
- Bybit: al no tener firehose, si un simbolo con poco volumen se liquida
  fuera del top-N no lo vas a ver salvo que lo agregues a
  `SYMBOLS_WHITELIST` a mano.
- OKX es best-effort: verificar el esquema contra la doc oficial vigente
  antes de confiar en el en produccion (ver comentario en `exchanges/okx.py`).
- No es asesoramiento financiero ni una senal de trading — es una
  herramienta de observacion de estructura de mercado.
