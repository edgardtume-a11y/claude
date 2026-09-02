from __future__ import annotations

import logging

import aiohttp

log = logging.getLogger("liqbot.telegram")

API_URL = "https://api.telegram.org/bot{token}/sendMessage"


class TelegramNotifier:
    def __init__(self, token: str, chat_id: str):
        self._url = API_URL.format(token=token)
        self._chat_id = chat_id
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> "TelegramNotifier":
        self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        return self

    async def __aexit__(self, *exc) -> None:
        if self._session:
            await self._session.close()

    async def send(self, text: str) -> None:
        assert self._session is not None, "use TelegramNotifier as an async context manager"
        payload = {
            "chat_id": self._chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        try:
            async with self._session.post(self._url, json=payload) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("telegram send failed (%s): %s", resp.status, body[:300])
        except Exception:  # noqa: BLE001 - never let a notify failure kill the bot
            log.exception("telegram send raised")
