from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import aiohttp
import websockets

from .base import LONG_LIQUIDATED, SHORT_LIQUIDATED, ExchangeConnector, LiquidationEvent

log = logging.getLogger("liqbot.bybit")

WS_URL = "wss://stream.bybit.com/v5/public/linear"
TICKERS_URL = "https://api.bybit.com/v5/market/tickers?category=linear"

# Bybit's public liquidation channel has no "all symbols" firehose like
# Binance -- you subscribe per symbol (topic "liquidation.<symbol>"). If the
# user didn't pin a whitelist, we rank USDT perpetuals by 24h turnover and
# subscribe to the top N, refreshing periodically so the list tracks whatever
# is actually trading.
_SUBSCRIBE_CHUNK = 10


class BybitConnector(ExchangeConnector):
    name = "bybit"

    def __init__(
        self,
        queue,
        top_n: int = 50,
        symbols_whitelist: list[str] | None = None,
        refresh_seconds: float = 3600.0,
    ):
        super().__init__(queue)
        self.top_n = top_n
        self.symbols_whitelist = symbols_whitelist
        self.refresh_seconds = refresh_seconds

    async def _resolve_symbols(self) -> list[str]:
        if self.symbols_whitelist:
            return list(self.symbols_whitelist)
        async with aiohttp.ClientSession() as session:
            async with session.get(TICKERS_URL, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                data = await resp.json()
        rows = data.get("result", {}).get("list", [])
        rows.sort(key=lambda r: float(r.get("turnover24h") or 0.0), reverse=True)
        return [r["symbol"] for r in rows if r["symbol"].endswith("USDT")][: self.top_n]

    async def run(self) -> None:
        backoff = 1.0
        while True:
            try:
                symbols = await self._resolve_symbols()
                if not symbols:
                    log.warning("could not resolve any symbol, retrying in 30s")
                    await asyncio.sleep(30)
                    continue

                async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
                    topics = [f"liquidation.{s}" for s in symbols]
                    for i in range(0, len(topics), _SUBSCRIBE_CHUNK):
                        await ws.send(json.dumps({"op": "subscribe", "args": topics[i : i + _SUBSCRIBE_CHUNK]}))
                        await asyncio.sleep(0.2)
                    log.info("connected, subscribed to %d symbols", len(topics))
                    backoff = 1.0

                    refresh_at = time.monotonic() + self.refresh_seconds
                    while True:
                        timeout = max(1.0, refresh_at - time.monotonic())
                        try:
                            raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
                        except asyncio.TimeoutError:
                            break  # periodic re-subscribe with a fresh top-N list
                        await self._handle(raw)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("disconnected (%s); reconnecting in %.0fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)

    async def _handle(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
            if not str(msg.get("topic", "")).startswith("liquidation."):
                return
            data = msg["data"]
            items = data if isinstance(data, list) else [data]
            for item in items:
                # item["side"] is the side of the order Bybit fires to close
                # the position: Buy closes a short, Sell closes a long.
                side = SHORT_LIQUIDATED if item["side"].lower() == "buy" else LONG_LIQUIDATED
                price = float(item["price"])
                qty = float(item["size"])
                ts_ms = int(item.get("updatedTime") or msg.get("ts") or 0)
                event = LiquidationEvent(
                    exchange=self.name,
                    symbol=item["symbol"],
                    side=side,
                    price=price,
                    qty=qty,
                    value_usd=price * qty,
                    ts=datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
                    if ts_ms
                    else datetime.now(timezone.utc),
                )
                await self.queue.put(event)
        except Exception:  # noqa: BLE001
            log.exception("could not parse message: %s", raw[:300])
