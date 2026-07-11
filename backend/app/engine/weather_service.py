from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

from app.config import SETTINGS


WEATHER_LOCATIONS = [
    {"id": "yeongdeok", "label": "영덕", "latitude": 36.4151, "longitude": 129.3650, "provider": "open-meteo", "enabled": True, "display_order": 0},
    {"id": "pohang", "label": "포항", "latitude": 36.0190, "longitude": 129.3435, "provider": "open-meteo", "enabled": True, "display_order": 1},
    {"id": "daegu", "label": "대구", "latitude": 35.8714, "longitude": 128.6014, "provider": "open-meteo", "enabled": True, "display_order": 2},
    {"id": "yeongcheon", "label": "영천", "latitude": 35.9733, "longitude": 128.9386, "provider": "open-meteo", "enabled": True, "display_order": 3},
]
DEFAULT_WEATHER_LOCATION_ID = "pohang"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL_MINUTES = 60
WEATHER_DAYPARTS = [
    ("Morning", range(6, 12)),
    ("Afternoon", range(12, 18)),
    ("Evening", range(18, 22)),
    ("Night", (*range(0, 6), *range(22, 24))),
]
WEATHER_CONDITION_SEVERITY = {
    "unknown": 0,
    "clear": 1,
    "partly_cloudy": 2,
    "cloudy": 3,
    "fog": 4,
    "rain": 5,
    "snow": 6,
    "thunderstorm": 7,
}

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

    def fetch_hourly(self, location: dict, target_date: str) -> list[dict]:
        return self.fetch_hourly_range(location, target_date, target_date)

    def fetch_hourly_range(self, location: dict, start_date: str, end_date: str) -> list[dict]:
        query = urlencode(
            {
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "hourly": "weather_code,temperature_2m",
                "timezone": SETTINGS.APP_TIMEZONE,
                "start_date": start_date,
                "end_date": end_date,
            }
        )
        with urlopen(f"{OPEN_METEO_URL}?{query}", timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        hourly = payload.get("hourly") if isinstance(payload, dict) else {}
        if not isinstance(hourly, dict):
            return []
        times = hourly.get("time") or []
        codes = hourly.get("weather_code") or []
        temperatures = hourly.get("temperature_2m") or []
        rows = []
        for index, timestamp in enumerate(times):
            try:
                rows.append(
                    {
                        "time": str(timestamp),
                        "weather_code": int(codes[index]),
                        "temp_c": round_celsius(temperatures[index]),
                    }
                )
            except (IndexError, TypeError, ValueError):
                continue
        return rows


class WeatherService:
    def __init__(self, weather_repo, provider=None) -> None:
        self.weather_repo = weather_repo
        self.provider = provider or OpenMeteoWeatherProvider()

    def get_shared_weather(self) -> dict:
        self.weather_repo.ensure_locations(WEATHER_LOCATIONS)
        locations = self.weather_repo.list_locations(enabled_only=True)
        return {
            "ok": True,
            "ttl_seconds": WEATHER_CACHE_TTL_MINUTES * 60,
            "locations": [self._location_weather(location) for location in locations],
        }

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

    def get_dayparts(self, *, location_id: str | None, target_date: str) -> dict:
        location = get_weather_location(location_id)
        if location is None:
            return {
                "ok": False,
                "date": target_date,
                "weather_dayparts_available": False,
                "weather_unavailable_reason": "Invalid weather location.",
                "locations": weather_locations_public(),
                "weather_dayparts": [],
            }
        try:
            date.fromisoformat(target_date)
        except (TypeError, ValueError):
            target_date = self._today().isoformat()

        fetch_hourly = getattr(self.provider, "fetch_hourly", None)
        if not callable(fetch_hourly):
            return self._dayparts_unavailable(
                location=location,
                target_date=target_date,
                reason="Weather info not available by time of day.",
            )

        try:
            hourly_rows = fetch_hourly(location, target_date)
        except Exception:
            return self._dayparts_unavailable(
                location=location,
                target_date=target_date,
                reason="Weather info not available.",
            )

        dayparts = self._hourly_rows_to_dayparts(hourly_rows)
        if not dayparts:
            return self._dayparts_unavailable(
                location=location,
                target_date=target_date,
                reason="Weather info not available by time of day.",
            )
        return {
            "ok": True,
            "date": target_date,
            "location": {"id": location["id"], "label": location["label"]},
            "locations": weather_locations_public(),
            "weather_dayparts_available": True,
            "weather_dayparts": dayparts,
        }

    def _location_weather(self, location: dict) -> dict:
        now = self._now()
        cache = self.weather_repo.get_cache(location_id=location["id"])
        if cache and self._cache_row_is_fresh(cache, now):
            return self._cached_location_response(location=location, cache=cache, stale=False)

        try:
            payload, fetched_at = self._fetch_shared_payload(location=location)
        except Exception:
            if cache:
                return self._cached_location_response(location=location, cache=cache, stale=True)
            return {
                "id": location["id"],
                "label": location["label"],
                "provider": location.get("provider") or "open-meteo",
                "stale": True,
                "error": "weather unavailable",
                "fetched_at": None,
                "expires_at": None,
                "weather": {
                    "daily": [],
                    "dayparts": {},
                },
            }

        expires_at = (now + timedelta(minutes=WEATHER_CACHE_TTL_MINUTES)).isoformat(timespec="seconds")
        self.weather_repo.upsert_cache(
            location_id=location["id"],
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            fetched_at=fetched_at,
            expires_at=expires_at,
        )
        return {
            "id": location["id"],
            "label": location["label"],
            "provider": location.get("provider") or "open-meteo",
            "stale": False,
            "fetched_at": fetched_at,
            "expires_at": expires_at,
            "weather": payload,
        }

    def _cached_location_response(self, *, location: dict, cache: dict, stale: bool) -> dict:
        try:
            payload = json.loads(cache.get("payload_json") or "{}")
        except (TypeError, ValueError):
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        payload.setdefault("daily", [])
        payload.setdefault("dayparts", {})
        return {
            "id": location["id"],
            "label": location["label"],
            "provider": location.get("provider") or "open-meteo",
            "stale": stale,
            "fetched_at": cache.get("fetched_at"),
            "expires_at": cache.get("expires_at"),
            "weather": payload,
        }

    def _cache_row_is_fresh(self, cache: dict, now: datetime) -> bool:
        try:
            expires_at = datetime.fromisoformat(str(cache.get("expires_at") or ""))
        except ValueError:
            return False
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=now.tzinfo)
        return expires_at > now

    def _fetch_shared_payload(self, *, location: dict) -> tuple[dict, str]:
        now = self._now()
        fetched_at = now.isoformat(timespec="seconds")
        daily_items = []
        snapshots = []
        dayparts_by_date = {}
        fetch_hourly_range = getattr(self.provider, "fetch_hourly_range", None)
        fetch_hourly = getattr(self.provider, "fetch_hourly", None)

        for row in self.provider.fetch_daily(location):
            condition = weather_code_to_condition(row.get("weather_code"))
            item = {
                "date": str(row["date"]),
                "condition": condition,
                "glyph": weather_glyph_for_condition(condition),
                "weather_code": int(row["weather_code"]),
                "min_c": round_celsius(row["min_c"]),
                "max_c": round_celsius(row["max_c"]),
                "fetched_at": fetched_at,
            }
            daily_items.append(item)
            snapshots.append(
                {
                    "id": f"{location['id']}:{item['date']}",
                    "location_id": location["id"],
                    "location_label": location["label"],
                    "date": item["date"],
                    "condition_bucket": condition,
                    "weather_glyph": item["glyph"],
                    "weather_code": item["weather_code"],
                    "min_c": item["min_c"],
                    "max_c": item["max_c"],
                    "source": location.get("provider") or "open-meteo",
                    "fetched_at": fetched_at,
                }
            )

        if daily_items:
            daily_dates = [item["date"] for item in daily_items]
            if callable(fetch_hourly_range):
                try:
                    hourly_rows = fetch_hourly_range(location, daily_dates[0], daily_dates[-1])
                    dayparts_by_date = self._hourly_rows_to_dayparts_by_date(hourly_rows, daily_dates)
                except Exception:
                    dayparts_by_date = {target_date: [] for target_date in daily_dates}
            elif callable(fetch_hourly):
                for target_date in daily_dates:
                    try:
                        dayparts_by_date[target_date] = self._hourly_rows_to_dayparts(fetch_hourly(location, target_date))
                    except Exception:
                        dayparts_by_date[target_date] = []

        self.weather_repo.upsert_snapshots(snapshots)
        return {
            "daily": daily_items,
            "dayparts": dayparts_by_date,
        }, fetched_at

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

    def _dayparts_unavailable(self, *, location: dict, target_date: str, reason: str) -> dict:
        return {
            "ok": True,
            "date": target_date,
            "location": {"id": location["id"], "label": location["label"]},
            "locations": weather_locations_public(),
            "weather_dayparts_available": False,
            "weather_unavailable_reason": reason,
            "weather_dayparts": [],
        }

    def _hourly_rows_to_dayparts(self, hourly_rows: list[dict]) -> list[dict]:
        by_hour = {}
        for row in hourly_rows:
            try:
                hour = datetime.fromisoformat(str(row.get("time"))).hour
                temp_c = round_celsius(row.get("temp_c"))
                weather_code = int(row.get("weather_code"))
            except (TypeError, ValueError):
                continue
            by_hour[hour] = {"temp_c": temp_c, "weather_code": weather_code}

        dayparts = []
        for label, hours in WEATHER_DAYPARTS:
            rows = [by_hour[hour] for hour in hours if hour in by_hour]
            if not rows:
                continue
            codes = [row["weather_code"] for row in rows]
            representative_code = max(
                codes,
                key=lambda code: WEATHER_CONDITION_SEVERITY.get(weather_code_to_condition(code), 0),
            )
            condition = weather_code_to_condition(representative_code)
            temps = [row["temp_c"] for row in rows]
            dayparts.append(
                {
                    "label": label,
                    "glyph": weather_glyph_for_condition(condition),
                    "weather_code": representative_code,
                    "temp_min_c": min(temps),
                    "temp_max_c": max(temps),
                    "available": True,
                }
            )
        return dayparts

    def _hourly_rows_to_dayparts_by_date(self, hourly_rows: list[dict], target_dates: list[str]) -> dict[str, list[dict]]:
        grouped: dict[str, list[dict]] = {target_date: [] for target_date in target_dates}
        wanted_dates = set(grouped)
        for row in hourly_rows:
            timestamp = str(row.get("time") or "")
            row_date = timestamp[:10]
            if row_date not in wanted_dates:
                continue
            grouped[row_date].append(row)
        return {target_date: self._hourly_rows_to_dayparts(grouped[target_date]) for target_date in target_dates}
