from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets

from .base import LONG_LIQUIDATED, SHORT_LIQUIDATED, ExchangeConnector, LiquidationEvent

log = logging.getLogger("liqbot.okx")

WS_URL = "wss://ws.okx.com:8443/ws/v5/public"

# BEST-EFFORT connector. OKX's public "liquidation-orders" channel pushes
# periodic batches (not a per-event firehose like Binance/Bybit) and the
# exact field names below are written from documented shape at design time,
# not verified live. Before relying on this in production:
#   https://www.okx.com/docs-v5/en/#public-data-websocket-liquidation-orders-channel
# The handler is defensive on purpose: any unexpected shape is logged and
# skipped instead of crashing the whole bot.
class OKXConnector(ExchangeConnector):
    name = "okx"

    async def run(self) -> None:
        backoff = 1.0
        while True:
            try:
                async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
                    await ws.send(
                        json.dumps(
                            {
                                "op": "subscribe",
                                "args": [{"channel": "liquidation-orders", "instType": "SWAP"}],
                            }
                        )
                    )
                    log.info("connected")
                    backoff = 1.0
                    async for raw in ws:
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
            for group in msg.get("data", []):
                inst_id = group.get("instId", "?")
                for d in group.get("details", []):
                    price = float(d.get("bkPx") or d.get("fillPx") or 0)
                    qty = float(d.get("sz") or 0)
                    if not price or not qty:
                        continue
                    side = SHORT_LIQUIDATED if d.get("side") == "buy" else LONG_LIQUIDATED
                    ts_ms = int(d.get("ts") or 0)
                    event = LiquidationEvent(
                        exchange=self.name,
                        symbol=inst_id,
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
            log.exception("unexpected okx message shape (verify docs): %s", raw[:300])
