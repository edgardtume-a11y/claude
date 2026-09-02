from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _split_symbols(raw: str) -> list[str]:
    return [s.strip().upper() for s in raw.split(",") if s.strip()]


@dataclass(frozen=True)
class Config:
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "")

    symbols_whitelist: list[str] = field(
        default_factory=lambda: _split_symbols(os.getenv("SYMBOLS_WHITELIST", ""))
    )
    bybit_top_n_symbols: int = int(os.getenv("BYBIT_TOP_N_SYMBOLS", "50"))

    single_event_alert_usd: float = float(os.getenv("SINGLE_EVENT_ALERT_USD", "250000"))
    cluster_alert_usd: float = float(os.getenv("CLUSTER_ALERT_USD", "750000"))
    cluster_window_seconds: float = float(os.getenv("CLUSTER_WINDOW_SECONDS", "120"))
    cluster_price_bucket_pct: float = float(os.getenv("CLUSTER_PRICE_BUCKET_PCT", "0.15"))
    alert_cooldown_seconds: float = float(os.getenv("ALERT_COOLDOWN_SECONDS", "300"))

    db_path: str = os.getenv("DB_PATH", "liquidations.db")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    def validate(self) -> None:
        missing = []
        if not self.telegram_bot_token:
            missing.append("TELEGRAM_BOT_TOKEN")
        if not self.telegram_chat_id:
            missing.append("TELEGRAM_CHAT_ID")
        if missing:
            raise SystemExit(
                "Falta configurar en .env: " + ", ".join(missing) + "\n"
                "Copia .env.example a .env y completa los valores."
            )


config = Config()
