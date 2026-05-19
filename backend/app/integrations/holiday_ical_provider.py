from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Protocol
from urllib.request import urlopen


@dataclass(frozen=True)
class Holiday:
    external_id: str
    title: str
    start_date: str
    end_date: str | None = None
    uid: str | None = None


class HolidayProvider(Protocol):
    def fetch_holidays(self, *, start_year: int, end_year: int) -> list[Holiday]:
        ...


def normalized_summary(value: str) -> str:
    normalized = re.sub(r"\s+", "-", str(value or "").strip().lower())
    normalized = re.sub(r"[^0-9a-z가-힣_-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or "holiday"


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


class IcalHolidayProvider:
    def __init__(self, url: str, *, timeout_seconds: int = 10) -> None:
        self.url = str(url or "").strip()
        self.timeout_seconds = timeout_seconds

    def fetch_holidays(self, *, start_year: int, end_year: int) -> list[Holiday]:
        if not self.url:
            return []

        from icalendar import Calendar

        with urlopen(self.url, timeout=self.timeout_seconds) as response:
            calendar = Calendar.from_ical(response.read())

        holidays: list[Holiday] = []
        for component in calendar.walk("VEVENT"):
            title = str(component.get("SUMMARY") or "").strip()
            start = _as_date(component.get("DTSTART").dt if component.get("DTSTART") else None)
            if not title or start is None:
                continue
            if start.year < start_year or start.year > end_year:
                continue

            end_date = None
            raw_end = _as_date(component.get("DTEND").dt if component.get("DTEND") else None)
            if raw_end is not None:
                inclusive_end = raw_end - timedelta(days=1) if raw_end > start else raw_end
                if inclusive_end > start:
                    end_date = inclusive_end.isoformat()

            uid = str(component.get("UID") or "").strip() or None
            external_id = uid or f"kr-holiday:{start.isoformat()}:{normalized_summary(title)}"
            holidays.append(
                Holiday(
                    external_id=external_id,
                    uid=uid,
                    title=title,
                    start_date=start.isoformat(),
                    end_date=end_date,
                )
            )

        return holidays
