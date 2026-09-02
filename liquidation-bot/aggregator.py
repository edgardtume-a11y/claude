from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from alerts.telegram import TelegramNotifier
from config import Config
from exchanges.base import LiquidationEvent
from market_structure import MarketStructureCache
from storage import Storage

log = logging.getLogger("liqbot.aggregator")


@dataclass
class _Bucketed:
    ts_monotonic: float
    price: float
    value_usd: float


class Aggregator:
    """Consumes normalized LiquidationEvents, persists them, and raises two
    kinds of alerts:

    - single: one liquidation alone crosses SINGLE_EVENT_ALERT_USD.
    - cluster: liquidations of the SAME side, close in price (within
      CLUSTER_PRICE_BUCKET_PCT of each other) and close in time (within
      CLUSTER_WINDOW_SECONDS), whose combined USD crosses CLUSTER_ALERT_USD --
      this is the "wall" pattern: a lot of leverage unwinding at one level,
      which is exactly the kind of structural signal liquidation-heatmap
      posts are trying to call out ahead of a move.

    Clustering is done across all connected exchanges together (a wall at
    the same price on Binance + Bybit simultaneously is a stronger signal
    than either alone), keyed by (symbol, side).
    """

    def __init__(
        self,
        config: Config,
        storage: Storage,
        notifier: TelegramNotifier,
        market: MarketStructureCache | None = None,
    ):
        self.config = config
        self.storage = storage
        self.notifier = notifier
        self.market = market
        # (symbol, side) -> deque of recent bucketed events, oldest first
        self._buffers: dict[tuple[str, str], deque[_Bucketed]] = defaultdict(deque)
        # cooldown key -> monotonic time when it's allowed to fire again
        self._cooldowns: dict[str, float] = {}

    async def handle(self, event: LiquidationEvent) -> None:
        await self.storage.insert(event)

        if event.value_usd >= self.config.single_event_alert_usd:
            await self._maybe_alert(
                key=f"single:{event.exchange}:{event.symbol}:{event.side}",
                text=self._format_single(event),
            )

        await self._update_cluster(event)

    async def _update_cluster(self, event: LiquidationEvent) -> None:
        key = (event.symbol, event.side)
        buf = self._buffers[key]
        now = time.monotonic()
        buf.append(_Bucketed(ts_monotonic=now, price=event.price, value_usd=event.value_usd))

        window = self.config.cluster_window_seconds
        while buf and now - buf[0].ts_monotonic > window:
            buf.popleft()

        bucket_pct = self.config.cluster_price_bucket_pct / 100.0
        lo = event.price * (1 - bucket_pct)
        hi = event.price * (1 + bucket_pct)
        cluster_value = sum(b.value_usd for b in buf if lo <= b.price <= hi)

        if cluster_value >= self.config.cluster_alert_usd:
            bucket_id = round(event.price / (event.price * bucket_pct * 2 or 1))
            await self._maybe_alert(
                key=f"cluster:{event.symbol}:{event.side}:{bucket_id}",
                text=self._format_cluster(event, cluster_value, window),
            )

    async def _maybe_alert(self, key: str, text: str) -> None:
        now = time.monotonic()
        ready_at = self._cooldowns.get(key, 0.0)
        if now < ready_at:
            return
        self._cooldowns[key] = now + self.config.alert_cooldown_seconds
        log.info("alert: %s", text.splitlines()[0])
        await self.notifier.send(text)

    def _market_lines(self, exchange: str, symbol: str) -> list[str]:
        """Funding rate / open interest, formatted like the context line
        under a CoinGlass or Binance-Square liquidation post. Empty when we
        have no snapshot yet (first ~5 min after startup) or the field isn't
        available for that exchange (see MarketStructureCache docstring)."""
        if not self.market:
            return []
        snap = self.market.get(exchange, symbol)
        if not snap:
            return []
        parts = []
        if snap.funding_rate is not None:
            parts.append(f"funding {snap.funding_rate * 100:+.4f}%")
        if snap.open_interest_usd is not None:
            parts.append(f"OI ${snap.open_interest_usd:,.0f}")
        return [f"📊 {' · '.join(parts)}"] if parts else []

    def _format_single(self, event: LiquidationEvent) -> str:
        side_emoji = "🔴" if event.side == "LONG_LIQUIDATED" else "🟢"
        side_label = "LONG liquidado" if event.side == "LONG_LIQUIDATED" else "SHORT liquidado"
        lines = [
            f"🔥 <b>LIQUIDACION</b> — {event.exchange.upper()} {event.symbol}",
            f"{side_emoji} {side_label}",
            f"💰 ${event.value_usd:,.0f} @ {event.price:g}",
            *self._market_lines(event.exchange, event.symbol),
        ]
        return "\n".join(lines)

    def _format_cluster(self, event: LiquidationEvent, cluster_value: float, window: float) -> str:
        side_emoji = "🔴" if event.side == "LONG_LIQUIDATED" else "🟢"
        side_label = "LONGS" if event.side == "LONG_LIQUIDATED" else "SHORTS"
        lines = [
            f"🧱 <b>MURO DE LIQUIDACIONES</b> — {event.symbol}",
            f"{side_emoji} {side_label} por ${cluster_value:,.0f} cerca de {event.price:g}",
            f"⏱ ultimos {window:.0f}s (todas las exchanges trackeadas)",
            *self._market_lines(event.exchange, event.symbol),
        ]
        return "\n".join(lines)
