from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import SETTINGS


def format_dt_for_ui(value: str | None) -> str | None:
    if not value:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
    else:
        dt = dt.astimezone(ZoneInfo(SETTINGS.APP_TIMEZONE))

    return dt.strftime("%Y-%m-%d %H:%M")


def local_date_key_for_ui(value: str | None) -> str | None:
    if not value:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
    else:
        dt = dt.astimezone(ZoneInfo(SETTINGS.APP_TIMEZONE))

    return dt.strftime("%Y-%m-%d")
