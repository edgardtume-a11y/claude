"""End-to-end test of the local dashboard: real aiohttp server on a random
port, in-memory sqlite, no exchange network. Checks the page, the two JSON
endpoints and the websocket push."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import aiohttp

from exchanges.base import LONG_LIQUIDATED, SHORT_LIQUIDATED, LiquidationEvent
from storage import Storage
from web.server import DashboardServer


def _event(symbol, side, price, qty, exchange="binance"):
    return LiquidationEvent(
        exchange=exchange, symbol=symbol, side=side, price=price, qty=qty,
        value_usd=price * qty, ts=datetime.now(timezone.utc),
    )


async def _run():
    storage = Storage(":memory:")
    await storage.insert(_event("BTCUSDT", LONG_LIQUIDATED, 60_000, 2.0))      # $120k long
    await storage.insert(_event("BTCUSDT", SHORT_LIQUIDATED, 60_100, 0.5))     # $30k short
    await storage.insert(_event("ETHUSDT", SHORT_LIQUIDATED, 3_000, 10.0, "bybit"))  # $30k short
    await storage.insert(_event("DOGEUSDT", LONG_LIQUIDATED, 0.1, 500.0))      # $50 -> below min_usd

    server = DashboardServer(storage, host="127.0.0.1", port=0)
    await server.start()
    port = server._runner.addresses[0][1]
    base = f"http://127.0.0.1:{port}"

    async with aiohttp.ClientSession() as s:
        # page
        async with s.get(base + "/") as r:
            assert r.status == 200, r.status
            html = await r.text()
            assert "Liquidaciones en vivo" in html

        # recent, with min_usd filter dropping the $50 DOGE event
        async with s.get(base + "/api/recent?min_usd=1000") as r:
            rows = await r.json()
        assert [x["symbol"] for x in rows] == ["ETHUSDT", "BTCUSDT", "BTCUSDT"], rows

        # recent filtered by exchange
        async with s.get(base + "/api/recent?exchange=bybit") as r:
            rows = await r.json()
        assert len(rows) == 1 and rows[0]["symbol"] == "ETHUSDT"

        # summary: totals + per-symbol ranking
        async with s.get(base + "/api/summary?hours=24") as r:
            summ = await r.json()
        assert summ["count"] == 4
        assert abs(summ["long_usd"] - 120_050) < 1e-6, summ
        assert abs(summ["short_usd"] - 60_050) < 1e-6, summ
        assert summ["symbols"][0]["symbol"] == "BTCUSDT"
        assert abs(summ["symbols"][0]["long_usd"] - 120_000) < 1e-6

        # websocket push
        async with s.ws_connect(base + "/ws") as ws:
            await asyncio.sleep(0.05)  # let the server register the client
            await server.broadcast(_event("SOLUSDT", SHORT_LIQUIDATED, 150.0, 1000.0))
            msg = await asyncio.wait_for(ws.receive(), timeout=2)
            data = json.loads(msg.data)
            assert data["type"] == "liquidation" and data["symbol"] == "SOLUSDT"
            assert data["value_usd"] == 150_000.0

    await server.stop()
    storage.close()


def test_dashboard_end_to_end():
    asyncio.run(_run())


if __name__ == "__main__":
    test_dashboard_end_to_end()
    print("dashboard e2e OK")
