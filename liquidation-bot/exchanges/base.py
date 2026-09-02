from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

# Normalized "side" values. We report the side of the POSITION that got
# liquidated (not the raw order side each exchange sends), so every
# connector must translate its own buy/sell field into one of these two.
LONG_LIQUIDATED = "LONG_LIQUIDATED"
SHORT_LIQUIDATED = "SHORT_LIQUIDATED"


@dataclass(frozen=True, slots=True)
class LiquidationEvent:
    exchange: str
    symbol: str
    side: str  # LONG_LIQUIDATED | SHORT_LIQUIDATED
    price: float
    qty: float
    value_usd: float
    ts: datetime  # UTC, tz-aware


class ExchangeConnector(ABC):
    """One connector = one exchange's liquidation feed.

    run() must loop forever: connect, stream events into self.queue,
    reconnect with backoff on any disconnect/error. It only returns on
    asyncio.CancelledError (clean shutdown).
    """

    name: str

    def __init__(self, queue: "asyncio.Queue[LiquidationEvent]"):
        self.queue = queue

    @abstractmethod
    async def run(self) -> None: ...
