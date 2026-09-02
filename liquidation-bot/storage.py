from __future__ import annotations

import asyncio
import sqlite3
from datetime import datetime, timezone

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

    def close(self) -> None:
        self._conn.close()
