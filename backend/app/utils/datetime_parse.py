from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS

DEFAULT_HOUR = 10
DEFAULT_MINUTE = 30

DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_ONLY_PATTERN = re.compile(r"^(?P<hour>\d{2}):(?P<minute>\d{2})$")
RELATIVE_DAY_PATTERN = re.compile(
    r"^\+(?P<days>\d+)d(?:\s+(?P<hour>\d{2}):(?P<minute>\d{2}))?$",
    flags=re.IGNORECASE,
)
TODAY_TOMORROW_PATTERN = re.compile(
    r"^(?P<keyword>today|tomorrow)(?:\s+(?P<hour>\d{2}):(?P<minute>\d{2}))?$",
    flags=re.IGNORECASE,
)


def _current_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_hour_minute(hour: str, minute: str) -> tuple[int, int]:
    parsed_hour = int(hour)
    parsed_minute = int(minute)
    if not (0 <= parsed_hour <= 23 and 0 <= parsed_minute <= 59):
        raise ValueError("invalid datetime format")
    return parsed_hour, parsed_minute


def _resolve_with_default_time(base_date: datetime, hour: int | None, minute: int | None) -> datetime:
    resolved_hour = DEFAULT_HOUR if hour is None else hour
    resolved_minute = DEFAULT_MINUTE if minute is None else minute
    return base_date.replace(
        hour=resolved_hour,
        minute=resolved_minute,
        second=0,
        microsecond=0,
    )


def _parse_local_datetime(raw: str, *, tz: ZoneInfo, now_utc: datetime) -> datetime:
    normalized = " ".join(raw.split())
    now_local = now_utc.astimezone(tz)

    match = TODAY_TOMORROW_PATTERN.fullmatch(normalized)
    if match:
        keyword = str(match.group("keyword")).lower()
        day_offset = 0 if keyword == "today" else 1
        base_date = (now_local + timedelta(days=day_offset)).replace(
            second=0,
            microsecond=0,
        )
        hour = match.group("hour")
        minute = match.group("minute")
        parsed_hour, parsed_minute = (None, None) if hour is None else _parse_hour_minute(hour, minute or "0")
        return _resolve_with_default_time(base_date, parsed_hour, parsed_minute)

    match = RELATIVE_DAY_PATTERN.fullmatch(normalized)
    if match:
        days = int(match.group("days"))
        hour = match.group("hour")
        minute = match.group("minute")
        parsed_hour, parsed_minute = (None, None) if hour is None else _parse_hour_minute(hour, minute or "0")
        base_date = (now_local + timedelta(days=days)).replace(
            second=0,
            microsecond=0,
        )
        return _resolve_with_default_time(base_date, parsed_hour, parsed_minute)

    match = TIME_ONLY_PATTERN.fullmatch(normalized)
    if match:
        parsed_hour, parsed_minute = _parse_hour_minute(match.group("hour"), match.group("minute"))
        return now_local.replace(
            hour=parsed_hour,
            minute=parsed_minute,
            second=0,
            microsecond=0,
        )

    if DATE_ONLY_PATTERN.fullmatch(normalized):
        try:
            base_date = datetime.strptime(normalized, "%Y-%m-%d").replace(tzinfo=tz)
        except ValueError as exc:
            raise ValueError(f"invalid datetime format: {raw}") from exc
        return _resolve_with_default_time(base_date, None, None)

    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(normalized, fmt).replace(tzinfo=tz)
        except ValueError:
            continue

    try:
        dt = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"invalid datetime format: {raw}") from exc

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)

    return dt.astimezone(tz)


def parse_local_datetime_to_iso(value: str | None, *, allow_past: bool = True) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    tz = ZoneInfo(SETTINGS.APP_TIMEZONE)
    now_utc = _current_utc_now()
    local_dt = _parse_local_datetime(raw, tz=tz, now_utc=now_utc)
    utc_dt = local_dt.astimezone(timezone.utc)
    if not allow_past and utc_dt < now_utc:
        raise ValueError("resolved datetime is in the past")
    return utc_dt.isoformat(timespec="seconds")
