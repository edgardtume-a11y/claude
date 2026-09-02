from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets

from .base import LONG_LIQUIDATED, SHORT_LIQUIDATED, ExchangeConnector, LiquidationEvent

log = logging.getLogger("liqbot.binance")

# USD(S)-M futures liquidation firehose: every symbol, one stream, no
# subscription needed. Docs: Binance Futures WS "Liquidation Order Streams".
URL = "wss://fstream.binance.com/ws/!forceOrder@arr"


class BinanceConnector(ExchangeConnector):
    name = "binance"

    def __init__(self, queue, symbols_whitelist: list[str] | None = None):
        super().__init__(queue)
        self.symbols_whitelist = set(symbols_whitelist) if symbols_whitelist else None

    async def run(self) -> None:
        backoff = 1.0
        while True:
            try:
                async with websockets.connect(URL, ping_interval=15, ping_timeout=10) as ws:
                    log.info("connected")
                    backoff = 1.0
                    async for raw in ws:
                        await self._handle(raw)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - reconnect on anything, log it
                log.warning("disconnected (%s); reconnecting in %.0fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)

    async def _handle(self, raw: str) -> None:
        try:
            o = json.loads(raw)["o"]
            symbol = o["s"]
            if self.symbols_whitelist and symbol not in self.symbols_whitelist:
                return

            # o["S"] is the side of the FORCED ORDER the exchange fires to
            # close the position: SELL closes a long, BUY closes a short.
            side = LONG_LIQUIDATED if o["S"] == "SELL" else SHORT_LIQUIDATED
            price = float(o["ap"]) or float(o["p"])
            qty = float(o["l"])  # quantity filled in this specific update
            event = LiquidationEvent(
                exchange=self.name,
                symbol=symbol,
                side=side,
                price=price,
                qty=qty,
                value_usd=price * qty,
                ts=datetime.fromtimestamp(o["T"] / 1000, tz=timezone.utc),
            )
            await self.queue.put(event)
        except Exception:  # noqa: BLE001
            log.exception("could not parse message: %s", raw[:300])
