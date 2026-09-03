from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from aiohttp import WSMsgType, web

from exchanges.base import LiquidationEvent
from storage import Storage

log = logging.getLogger("liqbot.web")

STATIC_DIR = Path(__file__).parent / "static"


class DashboardServer:
    """Local web dashboard: serves the HTML page, a small JSON API over the
    SQLite history, and a websocket that pushes every new liquidation to
    open browser tabs the moment the bot processes it.

    Bound to 127.0.0.1 by default so it's only reachable from this PC.
    """

    def __init__(self, storage: Storage, host: str = "127.0.0.1", port: int = 8080):
        self.storage = storage
        self.host = host
        self.port = port
        self._clients: set[web.WebSocketResponse] = set()
        self._runner: web.AppRunner | None = None

        self.app = web.Application()
        self.app.router.add_get("/", self._index)
        self.app.router.add_get("/api/recent", self._api_recent)
        self.app.router.add_get("/api/summary", self._api_summary)
        self.app.router.add_get("/ws", self._ws)
        self.app.router.add_static("/static/", STATIC_DIR, show_index=False)

    # ---- lifecycle --------------------------------------------------------

    async def start(self) -> None:
        self._runner = web.AppRunner(self.app, access_log=None)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()
        log.info("dashboard en http://%s:%d", self.host, self.port)

    async def stop(self) -> None:
        for ws in list(self._clients):
            await ws.close()
        if self._runner:
            await self._runner.cleanup()

    # ---- push -------------------------------------------------------------

    async def broadcast(self, event: LiquidationEvent) -> None:
        if not self._clients:
            return
        payload = json.dumps(
            {
                "type": "liquidation",
                "exchange": event.exchange,
                "symbol": event.symbol,
                "side": event.side,
                "price": event.price,
                "qty": event.qty,
                "value_usd": event.value_usd,
                "ts": event.ts.isoformat(),
            }
        )
        dead: list[web.WebSocketResponse] = []
        for ws in self._clients:
            try:
                await ws.send_str(payload)
            except Exception:  # noqa: BLE001 - a closed tab must not break the others
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)

    # ---- handlers ---------------------------------------------------------

    async def _index(self, _request: web.Request) -> web.Response:
        return web.FileResponse(STATIC_DIR / "index.html")

    async def _api_recent(self, request: web.Request) -> web.Response:
        q = request.query
        rows = await self.storage.recent(
            limit=int(q.get("limit", 200)),
            symbol=q.get("symbol") or None,
            exchange=q.get("exchange") or None,
            min_usd=float(q.get("min_usd", 0) or 0),
        )
        return web.json_response(rows)

    async def _api_summary(self, request: web.Request) -> web.Response:
        q = request.query
        data = await self.storage.summary(
            hours=float(q.get("hours", 24)),
            limit=int(q.get("limit", 50)),
            exchange=q.get("exchange") or None,
        )
        return web.json_response(data)

    async def _ws(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse(heartbeat=20)
        await ws.prepare(request)
        self._clients.add(ws)
        try:
            async for msg in ws:
                if msg.type in (WSMsgType.ERROR, WSMsgType.CLOSE):
                    break
        finally:
            self._clients.discard(ws)
        return ws
