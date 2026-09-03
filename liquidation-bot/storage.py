from __future__ import annotations

import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone

from exchanges.base import LiquidationEvent

_SCHEMA = """
CREATE TABLE IF NOT EXISTS liquidations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    qty REAL NOT NULL,
    value_usd REAL NOT NULL,
    ts_utc TEXT NOT NULL,
    inserted_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_liq_symbol_ts ON liquidations (symbol, ts_utc);
CREATE INDEX IF NOT EXISTS idx_liq_exchange ON liquidations (exchange);
"""


class Storage:
    """SQLite persistence for every normalized liquidation event.

    Writes happen off the event loop via asyncio.to_thread so a slow disk
    never blocks the websocket readers -- losing/delaying live events would
    be worse than a slightly stale DB write.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.executescript(_SCHEMA)
        self._conn.commit()
        self._lock = asyncio.Lock()

    async def insert(self, event: LiquidationEvent) -> None:
        async with self._lock:
            await asyncio.to_thread(self._insert_sync, event)

    def _insert_sync(self, event: LiquidationEvent) -> None:
        self._conn.execute(
            "INSERT INTO liquidations "
            "(exchange, symbol, side, price, qty, value_usd, ts_utc, inserted_at_utc) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                event.exchange,
                event.symbol,
                event.side,
                event.price,
                event.qty,
                event.value_usd,
                event.ts.isoformat(),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self._conn.commit()

    # ---- read side (dashboard) -------------------------------------------

    async def recent(
        self, limit: int = 200, symbol: str | None = None, exchange: str | None = None,
        min_usd: float = 0.0,
    ) -> list[dict]:
        async with self._lock:
            return await asyncio.to_thread(self._recent_sync, limit, symbol, exchange, min_usd)

    def _recent_sync(self, limit: int, symbol: str | None, exchange: str | None, min_usd: float) -> list[dict]:
        where = ["value_usd >= ?"]
        params: list = [min_usd]
        if symbol:
            where.append("symbol = ?")
            params.append(symbol.upper())
        if exchange:
            where.append("exchange = ?")
            params.append(exchange.lower())
        params.append(max(1, min(limit, 1000)))
        rows = self._conn.execute(
            "SELECT exchange, symbol, side, price, qty, value_usd, ts_utc "
            f"FROM liquidations WHERE {' AND '.join(where)} "
            "ORDER BY id DESC LIMIT ?",
            params,
        ).fetchall()
        keys = ("exchange", "symbol", "side", "price", "qty", "value_usd", "ts")
        return [dict(zip(keys, r)) for r in rows]

    async def summary(self, hours: float = 24.0, limit: int = 50, exchange: str | None = None) -> dict:
        async with self._lock:
            return await asyncio.to_thread(self._summary_sync, hours, limit, exchange)

    def _summary_sync(self, hours: float, limit: int, exchange: str | None) -> dict:
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        where = "ts_utc >= ?"
        params: list = [since]
        if exchange:
            where += " AND exchange = ?"
            params.append(exchange.lower())

        total_row = self._conn.execute(
            "SELECT COUNT(*), "
            "COALESCE(SUM(value_usd), 0), "
            "COALESCE(SUM(CASE WHEN side='LONG_LIQUIDATED' THEN value_usd ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN side='SHORT_LIQUIDATED' THEN value_usd ELSE 0 END), 0) "
            f"FROM liquidations WHERE {where}",
            params,
        ).fetchone()

        per_symbol = self._conn.execute(
            "SELECT symbol, COUNT(*), SUM(value_usd), "
            "SUM(CASE WHEN side='LONG_LIQUIDATED' THEN value_usd ELSE 0 END), "
            "SUM(CASE WHEN side='SHORT_LIQUIDATED' THEN value_usd ELSE 0 END) "
            f"FROM liquidations WHERE {where} "
            "GROUP BY symbol ORDER BY SUM(value_usd) DESC LIMIT ?",
            [*params, max(1, min(limit, 500))],
        ).fetchall()

        return {
            "hours": hours,
            "count": total_row[0],
            "total_usd": total_row[1],
            "long_usd": total_row[2],
            "short_usd": total_row[3],
            "symbols": [
                {"symbol": s, "count": c, "total_usd": t, "long_usd": l, "short_usd": sh}
                for (s, c, t, l, sh) in per_symbol
            ],
        }

    def close(self) -> None:
        self._conn.close()
