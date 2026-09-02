from __future__ import annotations

import re

_TAG_RE = re.compile(r"<[^>]+>")

_RESET = "\x1b[0m"
_BOLD = "\x1b[1m"
_RED = "\x1b[31m"
_GREEN = "\x1b[32m"
_CYAN = "\x1b[36m"


class ConsoleNotifier:
    """Prints alerts straight into the terminal the bot is running in --
    zero network hop, so there is no Telegram round-trip to wait on. Meant
    to run side by side with TelegramNotifier (see CompositeNotifier), or
    alone if Telegram isn't configured.
    """

    async def send(self, text: str) -> None:
        plain = _TAG_RE.sub("", text)  # strip the <b> Telegram uses
        color = _RED if "🔴" in plain else _GREEN if "🟢" in plain else _CYAN
        bar = "─" * 46
        print(f"{color}{_BOLD}{bar}{_RESET}")
        for line in plain.splitlines():
            print(f"{color}{line}{_RESET}")
        print(f"{color}{_BOLD}{bar}{_RESET}", flush=True)
