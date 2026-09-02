from __future__ import annotations

import asyncio
import logging
from typing import Protocol

log = logging.getLogger("liqbot.composite")


class Notifier(Protocol):
    async def send(self, text: str) -> None: ...


class CompositeNotifier:
    """Fans one alert out to several notifiers at once (e.g. console +
    Telegram). If one fails -- Telegram is down, rate-limited, whatever --
    the others still get the alert; the failure is logged, not raised.
    """

    def __init__(self, notifiers: list[Notifier]):
        self._notifiers = notifiers

    async def send(self, text: str) -> None:
        results = await asyncio.gather(
            *(n.send(text) for n in self._notifiers), return_exceptions=True
        )
        for notifier, result in zip(self._notifiers, results):
            if isinstance(result, Exception):
                log.exception(
                    "notifier %s failed", type(notifier).__name__, exc_info=result
                )
