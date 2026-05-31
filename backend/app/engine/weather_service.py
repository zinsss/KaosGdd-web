from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

from app.config import SETTINGS


WEATHER_LOCATIONS = [
    {"id": "yeongdeok", "label": "영덕", "latitude": 36.4151, "longitude": 129.3650},
    {"id": "pohang", "label": "포항", "latitude": 36.0190, "longitude": 129.3435},
    {"id": "daegu", "label": "대구", "latitude": 35.8714, "longitude": 128.6014},
]
DEFAULT_WEATHER_LOCATION_ID = "pohang"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL_MINUTES = 60

WEATHER_GLYPHS = {
    "clear": "",
    "partly_cloudy": "",
    "cloudy": "",
    "rain": "",
    "snow": "",
    "thunderstorm": "",
    "fog": "",
    "unknown": "",
}


def weather_locations_public() -> list[dict]:
    return [{"id": location["id"], "label": location["label"]} for location in WEATHER_LOCATIONS]


def get_weather_location(location_id: str | None) -> dict | None:
    wanted = (location_id or DEFAULT_WEATHER_LOCATION_ID).strip().lower()
    for location in WEATHER_LOCATIONS:
        if location["id"] == wanted:
            return location
    return None


def weather_code_to_condition(weather_code: int | None) -> str:
    try:
        code = int(weather_code)
    except (TypeError, ValueError):
        return "unknown"

    if code == 0:
        return "clear"
    if code in {1, 2}:
        return "partly_cloudy"
    if code == 3:
        return "cloudy"
    if code in {45, 48}:
        return "fog"
    if code in {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}:
        return "rain"
    if code in {71, 73, 75, 77, 85, 86}:
        return "snow"
    if code in {95, 96, 99}:
        return "thunderstorm"
    return "unknown"


def weather_glyph_for_condition(condition: str) -> str:
    return WEATHER_GLYPHS.get(condition, WEATHER_GLYPHS["unknown"])


def round_celsius(value) -> int:
    return round(float(value))


class OpenMeteoWeatherProvider:
    def fetch_daily(self, location: dict) -> list[dict]:
        query = urlencode(
            {
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "daily": "weather_code,temperature_2m_min,temperature_2m_max",
                "timezone": SETTINGS.APP_TIMEZONE,
                "forecast_days": 10,
            }
        )
        with urlopen(f"{OPEN_METEO_URL}?{query}", timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        daily = payload.get("daily") if isinstance(payload, dict) else {}
        if not isinstance(daily, dict):
            return []
        times = daily.get("time") or []
        codes = daily.get("weather_code") or []
        min_values = daily.get("temperature_2m_min") or []
        max_values = daily.get("temperature_2m_max") or []
        rows = []
        for index, day in enumerate(times):
            try:
                rows.append(
                    {
                        "date": str(day),
                        "weather_code": int(codes[index]),
                        "min_c": round_celsius(min_values[index]),
                        "max_c": round_celsius(max_values[index]),
                    }
                )
            except (IndexError, TypeError, ValueError):
                continue
        return rows


class WeatherService:
    def __init__(self, weather_repo, provider=None) -> None:
        self.weather_repo = weather_repo
        self.provider = provider or OpenMeteoWeatherProvider()

    def get_daily(self, *, location_id: str | None, start_date: str, end_date: str) -> dict:
        location = get_weather_location(location_id)
        if location is None:
            return {
                "ok": False,
                "error": "Invalid weather location.",
                "locations": weather_locations_public(),
            }

        refresh_error = None
        try:
            self._refresh_forecast_if_needed(location=location, end_date=end_date)
        except Exception:
            refresh_error = "weather unavailable"
        rows = self.weather_repo.list_snapshots(
            location_id=location["id"],
            start_date=start_date,
            end_date=end_date,
        )
        items = [
            self._snapshot_to_public(row)
            for row in rows
        ]
        if refresh_error and not items:
            return {
                "ok": False,
                "error": refresh_error,
                "location": {"id": location["id"], "label": location["label"]},
                "locations": weather_locations_public(),
                "items": [],
            }
        return {
            "ok": True,
            "location": {"id": location["id"], "label": location["label"]},
            "locations": weather_locations_public(),
            "items": items,
        }

    def _refresh_forecast_if_needed(self, *, location: dict, end_date: str) -> None:
        today = self._today()
        try:
            range_end = date.fromisoformat(end_date)
        except ValueError:
            range_end = today
        if range_end < today:
            return
        if self._cache_is_fresh(location["id"]):
            return

        fetched_at = self._now().isoformat(timespec="seconds")
        snapshots = []
        for row in self.provider.fetch_daily(location):
            condition = weather_code_to_condition(row.get("weather_code"))
            snapshots.append(
                {
                    "id": f"{location['id']}:{row['date']}",
                    "location_id": location["id"],
                    "location_label": location["label"],
                    "date": row["date"],
                    "condition_bucket": condition,
                    "weather_glyph": weather_glyph_for_condition(condition),
                    "weather_code": int(row["weather_code"]),
                    "min_c": round_celsius(row["min_c"]),
                    "max_c": round_celsius(row["max_c"]),
                    "source": "open-meteo",
                    "fetched_at": fetched_at,
                }
            )
        self.weather_repo.upsert_snapshots(snapshots)

    def _cache_is_fresh(self, location_id: str) -> bool:
        latest = self.weather_repo.latest_fetched_at(location_id=location_id)
        if not latest:
            return False
        try:
            fetched_at = datetime.fromisoformat(latest)
        except ValueError:
            return False
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        return self._now() - fetched_at < timedelta(minutes=WEATHER_CACHE_TTL_MINUTES)

    def _now(self) -> datetime:
        try:
            return datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE))
        except Exception:
            return datetime.now(timezone.utc)

    def _today(self) -> date:
        return self._now().date()

    def _snapshot_to_public(self, row: dict) -> dict:
        return {
            "date": row.get("date"),
            "condition": row.get("condition_bucket"),
            "glyph": row.get("weather_glyph"),
            "weather_code": row.get("weather_code"),
            "min_c": row.get("min_c"),
            "max_c": row.get("max_c"),
            "fetched_at": row.get("fetched_at"),
        }
