from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

import aiohttp

log = logging.getLogger("liqbot.market_structure")

# Bulk, official, no-auth REST endpoints -- this is the same underlying data
# CoinGlass-style dashboards chart (funding rate, open interest), pulled
# straight from each exchange instead of scraping a third-party site.
BINANCE_24H_TICKER_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr"
BINANCE_PREMIUM_INDEX_URL = "https://fapi.binance.com/fapi/v1/premiumIndex"
BYBIT_TICKERS_URL = "https://api.bybit.com/v5/market/tickers?category=linear"


@dataclass(frozen=True, slots=True)
class MarketSnapshot:
    exchange: str
    symbol: str
    funding_rate: float | None
    open_interest_usd: float | None
    fetched_at: float  # time.time()


class MarketStructureCache:
    """Keeps the latest funding-rate / open-interest snapshot per
    (exchange, symbol) in memory, refreshed on a timer, so alerts can quote
    market structure inline instead of just the bare liquidation number.

    Binance has no bulk open-interest endpoint (only per-symbol), and
    polling 100 symbols one-by-one every cycle isn't worth the rate-limit
    risk for a "nice to have" field -- so Binance snapshots carry funding
    rate only. Bybit's tickers endpoint returns funding AND open interest
    for every symbol in a single call, so its snapshots carry both. This is
    an API-shape asymmetry, not a bug.
    """

    def __init__(self, top_n: int = 100, interval_seconds: float = 300.0):
        self.top_n = top_n
        self.interval_seconds = interval_seconds
        self._snapshots: dict[tuple[str, str], MarketSnapshot] = {}

    def get(self, exchange: str, symbol: str) -> MarketSnapshot | None:
        return self._snapshots.get((exchange, symbol))

    async def run(self) -> None:
        while True:
            try:
                await asyncio.gather(self._poll_binance(), self._poll_bybit())
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - one bad poll must not kill the loop
                log.exception("market structure poll failed")
            await asyncio.sleep(self.interval_seconds)

    async def _poll_binance(self) -> None:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(BINANCE_24H_TICKER_URL) as resp:
                tickers = await resp.json()
            top_symbols = {
                t["symbol"]
                for t in sorted(
                    tickers, key=lambda t: float(t.get("quoteVolume") or 0.0), reverse=True
                )[: self.top_n]
            }
            async with session.get(BINANCE_PREMIUM_INDEX_URL) as resp:
                premiums = await resp.json()

        now = time.time()
        count = 0
        for p in premiums:
            symbol = p.get("symbol")
            if symbol not in top_symbols:
                continue
            try:
                funding = float(p["lastFundingRate"])
            except (KeyError, TypeError, ValueError):
                funding = None
            self._snapshots[("binance", symbol)] = MarketSnapshot(
                exchange="binance",
                symbol=symbol,
                funding_rate=funding,
                open_interest_usd=None,
                fetched_at=now,
            )
            count += 1
        log.info("binance market structure refreshed: %d symbols", count)

    async def _poll_bybit(self) -> None:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(BYBIT_TICKERS_URL) as resp:
                data = await resp.json()

        rows = data.get("result", {}).get("list", [])
        rows.sort(key=lambda r: float(r.get("turnover24h") or 0.0), reverse=True)

        now = time.time()
        count = 0
        for r in rows:
            symbol = r.get("symbol", "")
            if not symbol.endswith("USDT"):
                continue
            if count >= self.top_n:
                break
            try:
                funding = float(r["fundingRate"])
            except (KeyError, TypeError, ValueError):
                funding = None
            try:
                oi_usd = float(r["openInterestValue"])
            except (KeyError, TypeError, ValueError):
                oi_usd = None
            self._snapshots[("bybit", symbol)] = MarketSnapshot(
                exchange="bybit",
                symbol=symbol,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                fetched_at=now,
            )
            count += 1
        log.info("bybit market structure refreshed: %d symbols", count)
