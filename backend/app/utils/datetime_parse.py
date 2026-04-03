from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import SETTINGS


def parse_local_datetime_to_iso(value: str | None) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    normalized = " ".join(raw.split())

    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            dt = datetime.strptime(normalized, fmt)
            tz = ZoneInfo(SETTINGS.APP_TIMEZONE)
            return dt.replace(tzinfo=tz).isoformat(timespec="seconds")
        except ValueError:
            continue

    try:
        dt = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"invalid datetime format: {raw}") from exc

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
    else:
        dt = dt.astimezone(ZoneInfo(SETTINGS.APP_TIMEZONE))

    return dt.isoformat(timespec="seconds")
