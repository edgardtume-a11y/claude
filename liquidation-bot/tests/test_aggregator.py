"""Offline tests for Aggregator: no network, no Telegram, in-memory sqlite."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from aggregator import Aggregator
from config import Config
from exchanges.base import LONG_LIQUIDATED, SHORT_LIQUIDATED, LiquidationEvent
from storage import Storage


class FakeNotifier:
    def __init__(self):
        self.sent: list[str] = []

    async def send(self, text: str) -> None:
        self.sent.append(text)


def _event(symbol="BTCUSDT", side=LONG_LIQUIDATED, price=60000.0, qty=1.0, exchange="binance"):
    return LiquidationEvent(
        exchange=exchange,
        symbol=symbol,
        side=side,
        price=price,
        qty=qty,
        value_usd=price * qty,
        ts=datetime.now(timezone.utc),
    )


def _make_aggregator(**overrides) -> tuple[Aggregator, FakeNotifier]:
    cfg = Config(
        db_path=":memory:",
        single_event_alert_usd=overrides.get("single_event_alert_usd", 100_000),
        cluster_alert_usd=overrides.get("cluster_alert_usd", 200_000),
        cluster_window_seconds=overrides.get("cluster_window_seconds", 60),
        cluster_price_bucket_pct=overrides.get("cluster_price_bucket_pct", 0.2),
        alert_cooldown_seconds=overrides.get("alert_cooldown_seconds", 300),
    )
    notifier = FakeNotifier()
    storage = Storage(":memory:")
    return Aggregator(cfg, storage, notifier), notifier


def test_single_large_liquidation_alerts_once():
    async def run():
        # cluster_alert_usd disabled (very high) so this test isolates the
        # single-event path from the cluster path -- two $150k events in a
        # row would otherwise also cross a cluster threshold on their own.
        agg, notifier = _make_aggregator(single_event_alert_usd=100_000, cluster_alert_usd=10_000_000)
        await agg.handle(_event(price=150_000, qty=1.0))  # 150k >= 100k threshold
        assert len(notifier.sent) == 1
        assert "Liquidacion grande" in notifier.sent[0]

        # same key again immediately -> cooldown should suppress it
        await agg.handle(_event(price=150_000, qty=1.0))
        assert len(notifier.sent) == 1

    asyncio.run(run())


def test_small_liquidation_does_not_alert():
    async def run():
        agg, notifier = _make_aggregator(single_event_alert_usd=100_000, cluster_alert_usd=10_000_000)
        await agg.handle(_event(price=1_000, qty=1.0))  # $1,000, well under threshold
        assert notifier.sent == []

    asyncio.run(run())


def test_cluster_of_small_liquidations_triggers_wall_alert():
    async def run():
        agg, notifier = _make_aggregator(
            single_event_alert_usd=10_000_000,  # disable single-event path
            cluster_alert_usd=250_000,
            cluster_price_bucket_pct=0.5,
            cluster_window_seconds=60,
        )
        # five $60k shorts liquidated near the same price -> $300k cluster
        for _ in range(5):
            await agg.handle(_event(side=SHORT_LIQUIDATED, price=60_010, qty=1.0, exchange="binance"))
            await agg.handle(_event(side=SHORT_LIQUIDATED, price=59_990, qty=0.0, exchange="bybit"))

        assert any("Muro de liquidaciones" in msg for msg in notifier.sent)

    asyncio.run(run())


def test_opposite_sides_do_not_mix_into_same_cluster():
    async def run():
        agg, notifier = _make_aggregator(
            single_event_alert_usd=10_000_000,
            cluster_alert_usd=100_000,
            cluster_price_bucket_pct=0.5,
        )
        await agg.handle(_event(side=LONG_LIQUIDATED, price=60_000, qty=1.0))  # $60k long
        await agg.handle(_event(side=SHORT_LIQUIDATED, price=60_000, qty=1.0))  # $60k short
        # neither side alone crosses the $100k cluster threshold
        assert notifier.sent == []

    asyncio.run(run())


if __name__ == "__main__":
    test_single_large_liquidation_alerts_once()
    test_small_liquidation_does_not_alert()
    test_cluster_of_small_liquidations_triggers_wall_alert()
    test_opposite_sides_do_not_mix_into_same_cluster()
    print("all tests passed")
