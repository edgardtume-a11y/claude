from __future__ import annotations

import asyncio
import contextlib
import logging
import signal

from aggregator import Aggregator
from alerts.composite import CompositeNotifier
from alerts.console import ConsoleNotifier
from alerts.telegram import TelegramNotifier
from config import config
from exchanges.base import ExchangeConnector, LiquidationEvent
from exchanges.binance import BinanceConnector
from exchanges.bybit import BybitConnector
from exchanges.okx import OKXConnector
from market_structure import MarketStructureCache
from storage import Storage

log = logging.getLogger("liqbot.main")


def _build_connectors(queue: "asyncio.Queue[LiquidationEvent]") -> list[ExchangeConnector]:
    whitelist = config.symbols_whitelist or None
    return [
        BinanceConnector(queue, symbols_whitelist=whitelist),
        BybitConnector(queue, top_n=config.bybit_top_n_symbols, symbols_whitelist=whitelist),
        OKXConnector(queue),
    ]


async def _consume(
    queue: "asyncio.Queue[LiquidationEvent]",
    aggregator: Aggregator,
) -> None:
    while True:
        event = await queue.get()
        try:
            await aggregator.handle(event)
        except Exception:  # noqa: BLE001 - one bad event must never kill the loop
            log.exception("failed handling event: %s", event)
        finally:
            queue.task_done()


async def main() -> None:
    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    queue: "asyncio.Queue[LiquidationEvent]" = asyncio.Queue(maxsize=10_000)
    storage = Storage(config.db_path)
    connectors = _build_connectors(queue)
    market = MarketStructureCache(
        top_n=config.market_top_n, interval_seconds=config.market_snapshot_interval_seconds
    )

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass  # e.g. Windows without proactor signal support

    async with contextlib.AsyncExitStack() as stack:
        # Console alerts are always on: zero network hop, so they show up
        # in the terminal the instant an event is handled. Telegram is
        # added on top only if configured -- the bot is fully usable with
        # no Telegram setup at all.
        active_notifiers: list = [ConsoleNotifier()]
        if config.telegram_configured:
            telegram = await stack.enter_async_context(
                TelegramNotifier(config.telegram_bot_token, config.telegram_chat_id)
            )
            active_notifiers.append(telegram)
            await telegram.send("🤖 Liquidation bot arrancado")
        else:
            log.warning(
                "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados en .env -- "
                "solo alertas por consola"
            )

        notifier = CompositeNotifier(active_notifiers)
        aggregator = Aggregator(config, storage, notifier, market=market)
        log.info(
            "trackeando %s (top %d monedas por volumen para funding/OI)",
            ", ".join(c.name for c in connectors),
            config.market_top_n,
        )

        tasks = [asyncio.create_task(c.run(), name=f"connector:{c.name}") for c in connectors]
        tasks.append(asyncio.create_task(market.run(), name="market-structure"))
        tasks.append(asyncio.create_task(_consume(queue, aggregator), name="consumer"))

        await stop.wait()
        log.info("shutting down...")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    storage.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
