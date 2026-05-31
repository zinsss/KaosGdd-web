from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import create_engine, text

from app.db.repo.weather_repo import WeatherRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.weather_service import (
    DEFAULT_WEATHER_LOCATION_ID,
    WEATHER_GLYPHS,
    WeatherService,
    get_weather_location,
    round_celsius,
    weather_code_to_condition,
    weather_glyph_for_condition,
    weather_locations_public,
)


class FakeWeatherProvider:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.calls = 0

    def fetch_daily(self, location: dict) -> list[dict]:
        self.calls += 1
        return self.rows


def make_weather_service(tmp_path, rows: list[dict]):
    engine = create_engine(f"sqlite:///{tmp_path / 'weather.db'}")
    init_schema_v0(engine)
    repo = WeatherRepo(engine)
    provider = FakeWeatherProvider(rows)
    service = WeatherService(repo, provider=provider)
    service._now = lambda: datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc)
    return engine, repo, provider, service


def test_configured_weather_locations_include_expected_korean_labels() -> None:
    labels = {location["label"] for location in weather_locations_public()}
    assert {"영덕", "포항", "대구"}.issubset(labels)


def test_default_weather_location_is_pohang() -> None:
    assert DEFAULT_WEATHER_LOCATION_ID == "pohang"
    assert get_weather_location(None)["label"] == "포항"


def test_invalid_weather_location_returns_clear_error(tmp_path) -> None:
    _, _, _, service = make_weather_service(tmp_path, [])
    result = service.get_daily(location_id="busan", start_date="2026-05-31", end_date="2026-06-01")
    assert result["ok"] is False
    assert "Invalid weather location" in result["error"]


def test_open_meteo_weather_codes_map_to_condition_buckets() -> None:
    assert weather_code_to_condition(0) == "clear"
    assert weather_code_to_condition(2) == "partly_cloudy"
    assert weather_code_to_condition(3) == "cloudy"
    assert weather_code_to_condition(61) == "rain"
    assert weather_code_to_condition(71) == "snow"
    assert weather_code_to_condition(95) == "thunderstorm"
    assert weather_code_to_condition(45) == "fog"
    assert weather_code_to_condition(999) == "unknown"


def test_condition_bucket_maps_to_nerd_font_glyph() -> None:
    for condition in ["clear", "partly_cloudy", "cloudy", "rain", "snow", "thunderstorm", "fog", "unknown"]:
        assert weather_glyph_for_condition(condition) == WEATHER_GLYPHS[condition]


def test_min_max_celsius_are_rounded_whole_numbers() -> None:
    assert round_celsius(14.4) == 14
    assert round_celsius(14.5) == 14
    assert round_celsius(14.6) == 15
    assert isinstance(round_celsius(14.6), int)


def test_weather_snapshots_upsert_by_location_and_date(tmp_path) -> None:
    engine, repo, _, _ = make_weather_service(tmp_path, [])
    repo.upsert_snapshots(
        [
            {
                "id": "daegu:2026-05-31",
                "location_id": "daegu",
                "location_label": "대구",
                "date": "2026-05-31",
                "condition_bucket": "clear",
                "weather_glyph": WEATHER_GLYPHS["clear"],
                "weather_code": 0,
                "min_c": 10,
                "max_c": 20,
                "source": "test",
                "fetched_at": "2026-05-31T00:00:00+00:00",
            },
            {
                "id": "daegu:2026-05-31-replacement",
                "location_id": "daegu",
                "location_label": "대구",
                "date": "2026-05-31",
                "condition_bucket": "rain",
                "weather_glyph": WEATHER_GLYPHS["rain"],
                "weather_code": 61,
                "min_c": 12,
                "max_c": 21,
                "source": "test",
                "fetched_at": "2026-05-31T01:00:00+00:00",
            },
        ]
    )
    rows = repo.list_snapshots(location_id="daegu", start_date="2026-05-31", end_date="2026-05-31")
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM weather_daily_snapshots")).scalar_one()
    assert count == 1
    assert rows[0]["condition_bucket"] == "rain"
    assert rows[0]["max_c"] == 21


def test_repeated_fetch_updates_same_location_date_without_duplicate(tmp_path) -> None:
    engine, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10.1, "max_c": 20.4}],
    )
    service.get_daily(location_id="daegu", start_date="2026-05-31", end_date="2026-06-01")
    provider.rows = [{"date": "2026-05-31", "weather_code": 61, "min_c": 12.2, "max_c": 21.7}]
    service._cache_is_fresh = lambda location_id: False
    result = service.get_daily(location_id="daegu", start_date="2026-05-31", end_date="2026-06-01")
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM weather_daily_snapshots")).scalar_one()
    assert count == 1
    assert provider.calls == 2
    assert result["items"][0]["condition"] == "rain"
    assert result["items"][0]["max_c"] == 22


def test_fresh_cached_data_avoids_provider_call(tmp_path) -> None:
    _, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20}],
    )
    service.get_daily(location_id="daegu", start_date="2026-05-31", end_date="2026-06-01")
    service.get_daily(location_id="daegu", start_date="2026-05-31", end_date="2026-06-01")
    assert provider.calls == 1


def test_past_saved_snapshot_can_be_read_back_without_provider_call(tmp_path) -> None:
    _, repo, provider, service = make_weather_service(tmp_path, [])
    repo.upsert_snapshots(
        [
            {
                "id": "daegu:2026-05-20",
                "location_id": "daegu",
                "location_label": "대구",
                "date": "2026-05-20",
                "condition_bucket": "rain",
                "weather_glyph": WEATHER_GLYPHS["rain"],
                "weather_code": 61,
                "min_c": 15,
                "max_c": 21,
                "source": "test",
                "fetched_at": "2026-05-20T00:00:00+00:00",
            }
        ]
    )
    result = service.get_daily(location_id="daegu", start_date="2026-05-01", end_date="2026-05-20")
    assert provider.calls == 0
    assert result["items"][0]["date"] == "2026-05-20"


def test_future_forecast_dates_are_stored_and_returned(tmp_path) -> None:
    _, _, provider, service = make_weather_service(
        tmp_path,
        [
            {"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20},
            {"date": "2026-06-01", "weather_code": 61, "min_c": 15, "max_c": 21},
        ],
    )
    result = service.get_daily(location_id="daegu", start_date="2026-05-31", end_date="2026-06-01")
    assert provider.calls == 1
    assert [item["date"] for item in result["items"]] == ["2026-05-31", "2026-06-01"]
