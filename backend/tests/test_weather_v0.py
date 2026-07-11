from __future__ import annotations

from datetime import datetime, timezone

from fastapi import BackgroundTasks
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


class FailingWeatherProvider(FakeWeatherProvider):
    def fetch_daily(self, location: dict) -> list[dict]:
        self.calls += 1
        raise RuntimeError("offline")


class FakeHourlyWeatherProvider(FakeWeatherProvider):
    def __init__(self, rows: list[dict], hourly_rows: list[dict]) -> None:
        super().__init__(rows)
        self.hourly_rows = hourly_rows
        self.hourly_calls = 0

    def fetch_hourly(self, location: dict, target_date: str) -> list[dict]:
        self.hourly_calls += 1
        return self.hourly_rows


class FakeHourlyRangeWeatherProvider(FakeWeatherProvider):
    def __init__(self, rows: list[dict], hourly_rows: list[dict]) -> None:
        super().__init__(rows)
        self.hourly_rows = hourly_rows
        self.hourly_range_calls = []

    def fetch_hourly_range(self, location: dict, start_date: str, end_date: str) -> list[dict]:
        self.hourly_range_calls.append((location["id"], start_date, end_date))
        return self.hourly_rows


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
    assert {"영덕", "포항", "대구", "영천"}.issubset(labels)


def test_default_weather_location_is_pohang() -> None:
    assert DEFAULT_WEATHER_LOCATION_ID == "pohang"
    assert get_weather_location(None)["label"] == "포항"


def test_weather_locations_are_seeded_into_sqlite(tmp_path) -> None:
    engine, repo, _, service = make_weather_service(tmp_path, [])
    service.get_shared_weather()
    rows = repo.list_locations(enabled_only=True)

    assert [row["id"] for row in rows] == ["yeongdeok", "pohang", "daegu", "yeongcheon"]
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM weather_locations")).scalar_one()
    assert count == 4


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


def test_shared_weather_cache_miss_fetches_and_stores_enabled_locations(tmp_path) -> None:
    engine, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20}],
    )

    result = service.get_shared_weather()

    assert result["ok"] is True
    assert provider.calls == 4
    assert [item["id"] for item in result["locations"]] == ["yeongdeok", "pohang", "daegu", "yeongcheon"]
    assert result["locations"][0]["weather"]["daily"][0]["condition"] == "clear"
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM weather_cache")).scalar_one()
    assert count == 4


def test_shared_weather_fetches_hourly_dayparts_as_one_range_per_location(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'weather.db'}")
    init_schema_v0(engine)
    repo = WeatherRepo(engine)
    provider = FakeHourlyRangeWeatherProvider(
        [
            {"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20},
            {"date": "2026-06-01", "weather_code": 61, "min_c": 11, "max_c": 21},
        ],
        [
            {"time": "2026-05-31T06:00", "weather_code": 0, "temp_c": 10},
            {"time": "2026-05-31T12:00", "weather_code": 0, "temp_c": 20},
            {"time": "2026-06-01T06:00", "weather_code": 61, "temp_c": 11},
            {"time": "2026-06-01T12:00", "weather_code": 61, "temp_c": 21},
        ],
    )
    service = WeatherService(repo, provider=provider)
    service._now = lambda: datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc)

    result = service.get_shared_weather()

    assert provider.calls == 4
    assert provider.hourly_range_calls == [
        ("yeongdeok", "2026-05-31", "2026-06-01"),
        ("pohang", "2026-05-31", "2026-06-01"),
        ("daegu", "2026-05-31", "2026-06-01"),
        ("yeongcheon", "2026-05-31", "2026-06-01"),
    ]
    assert result["locations"][0]["weather"]["dayparts"]["2026-05-31"][0]["temp_min_c"] == 10
    assert result["locations"][0]["weather"]["dayparts"]["2026-06-01"][0]["weather_code"] == 61


def test_shared_weather_fresh_cache_skips_fetch(tmp_path) -> None:
    _, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20}],
    )

    service.get_shared_weather()
    service.get_shared_weather()

    assert provider.calls == 4


def test_shared_weather_expired_cache_refreshes(tmp_path) -> None:
    _, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20}],
    )
    service.get_shared_weather()
    provider.rows = [{"date": "2026-05-31", "weather_code": 61, "min_c": 12, "max_c": 21}]
    service._now = lambda: datetime(2026, 5, 31, 14, 0, tzinfo=timezone.utc)

    result = service.get_shared_weather()

    assert provider.calls == 8
    assert result["locations"][0]["stale"] is False
    assert result["locations"][0]["weather"]["daily"][0]["condition"] == "rain"


def test_shared_weather_expired_cache_returns_stale_before_background_refresh(tmp_path) -> None:
    _, _, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20}],
    )
    service.get_shared_weather()
    provider.rows = [{"date": "2026-05-31", "weather_code": 61, "min_c": 12, "max_c": 21}]
    service._now = lambda: datetime(2026, 5, 31, 14, 0, tzinfo=timezone.utc)
    background_tasks = BackgroundTasks()

    result = service.get_shared_weather(background_tasks=background_tasks)

    assert provider.calls == 4
    assert result["locations"][0]["stale"] is True
    assert result["locations"][0]["weather"]["daily"][0]["condition"] == "clear"
    assert len(background_tasks.tasks) == 4

    for task in background_tasks.tasks:
        task.func(*task.args, **task.kwargs)

    result = service.get_shared_weather()

    assert provider.calls == 8
    assert result["locations"][0]["stale"] is False
    assert result["locations"][0]["weather"]["daily"][0]["condition"] == "rain"


def test_shared_weather_provider_failure_returns_stale_cached_data(tmp_path) -> None:
    _, repo, provider, service = make_weather_service(
        tmp_path,
        [{"date": "2026-05-31", "weather_code": 3, "min_c": 10, "max_c": 20}],
    )
    service.get_shared_weather()
    service.provider = FailingWeatherProvider([])
    service._now = lambda: datetime(2026, 5, 31, 14, 0, tzinfo=timezone.utc)

    result = service.get_shared_weather()

    assert service.provider.calls == 4
    assert result["locations"][0]["stale"] is True
    assert result["locations"][0]["weather"]["daily"][0]["condition"] == "cloudy"
    assert repo.get_cache(location_id="pohang") is not None


def test_shared_weather_provider_failure_without_cache_returns_location_error(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'weather.db'}")
    init_schema_v0(engine)
    repo = WeatherRepo(engine)
    provider = FailingWeatherProvider([])
    service = WeatherService(repo, provider=provider)
    service._now = lambda: datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc)

    result = service.get_shared_weather()

    assert result["ok"] is True
    assert provider.calls == 4
    assert result["locations"][0]["stale"] is True
    assert result["locations"][0]["error"] == "weather unavailable"
    assert result["locations"][0]["weather"]["daily"] == []
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM weather_cache")).scalar_one()
    assert count == 0


def test_shared_weather_response_includes_saved_snapshot_history(tmp_path) -> None:
    _, repo, _, service = make_weather_service(
        tmp_path,
        [
            {"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20},
            {"date": "2026-06-01", "weather_code": 61, "min_c": 15, "max_c": 21},
        ],
    )
    repo.upsert_snapshots(
        [
            {
                "id": "pohang:2026-05-30",
                "location_id": "pohang",
                "location_label": "포항",
                "date": "2026-05-30",
                "condition_bucket": "cloudy",
                "weather_glyph": WEATHER_GLYPHS["cloudy"],
                "weather_code": 3,
                "min_c": 12,
                "max_c": 19,
                "source": "test",
                "fetched_at": "2026-05-30T00:00:00+00:00",
            }
        ]
    )

    result = service.get_shared_weather()

    pohang = next(location for location in result["locations"] if location["id"] == "pohang")
    dates = [item["date"] for item in pohang["weather"]["daily"]]
    assert dates == ["2026-05-30", "2026-05-31", "2026-06-01"]
    assert pohang["weather"]["daily"][0]["condition"] == "cloudy"


def test_shared_weather_response_can_be_limited_to_requested_range(tmp_path) -> None:
    _, repo, _, service = make_weather_service(
        tmp_path,
        [
            {"date": "2026-05-31", "weather_code": 0, "min_c": 10, "max_c": 20},
            {"date": "2026-06-01", "weather_code": 61, "min_c": 15, "max_c": 21},
        ],
    )
    repo.upsert_snapshots(
        [
            {
                "id": "pohang:2026-05-30",
                "location_id": "pohang",
                "location_label": "포항",
                "date": "2026-05-30",
                "condition_bucket": "cloudy",
                "weather_glyph": WEATHER_GLYPHS["cloudy"],
                "weather_code": 3,
                "min_c": 12,
                "max_c": 19,
                "source": "test",
                "fetched_at": "2026-05-30T00:00:00+00:00",
            }
        ]
    )

    result = service.get_shared_weather(start_date="2026-05-31", end_date="2026-05-31")

    pohang = next(location for location in result["locations"] if location["id"] == "pohang")
    assert [item["date"] for item in pohang["weather"]["daily"]] == ["2026-05-31"]


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


def test_weather_dayparts_are_computed_from_hourly_rows(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'weather.db'}")
    init_schema_v0(engine)
    repo = WeatherRepo(engine)
    provider = FakeHourlyWeatherProvider(
        [],
        [
            {"time": "2026-06-07T06:00", "weather_code": 3, "temp_c": 12},
            {"time": "2026-06-07T11:00", "weather_code": 61, "temp_c": 17},
            {"time": "2026-06-07T12:00", "weather_code": 0, "temp_c": 18},
            {"time": "2026-06-07T17:00", "weather_code": 0, "temp_c": 24},
            {"time": "2026-06-07T18:00", "weather_code": 1, "temp_c": 15},
            {"time": "2026-06-07T21:00", "weather_code": 2, "temp_c": 19},
            {"time": "2026-06-07T00:00", "weather_code": 61, "temp_c": 12},
            {"time": "2026-06-07T23:00", "weather_code": 61, "temp_c": 14},
        ],
    )
    service = WeatherService(repo, provider=provider)

    result = service.get_dayparts(location_id="pohang", target_date="2026-06-07")

    assert result["ok"] is True
    assert result["weather_dayparts_available"] is True
    assert [item["label"] for item in result["weather_dayparts"]] == ["Morning", "Afternoon", "Evening", "Night"]
    assert result["weather_dayparts"][0]["temp_min_c"] == 12
    assert result["weather_dayparts"][0]["temp_max_c"] == 17
    assert result["weather_dayparts"][0]["weather_code"] == 61
    assert result["weather_dayparts"][3]["temp_min_c"] == 12
    assert result["weather_dayparts"][3]["temp_max_c"] == 14
    assert provider.hourly_calls == 1


def test_weather_dayparts_report_time_of_day_unavailable_when_provider_has_no_hourly(tmp_path) -> None:
    _, _, _, service = make_weather_service(tmp_path, [])

    result = service.get_dayparts(location_id="pohang", target_date="2026-06-07")

    assert result["ok"] is True
    assert result["weather_dayparts_available"] is False
    assert result["weather_unavailable_reason"] == "Weather info not available by time of day."
    assert result["weather_dayparts"] == []


def test_weather_dayparts_report_weather_unavailable_when_hourly_fetch_fails(tmp_path) -> None:
    class FailingHourlyProvider(FakeWeatherProvider):
        def fetch_hourly(self, location: dict, target_date: str) -> list[dict]:
            raise RuntimeError("offline")

    engine = create_engine(f"sqlite:///{tmp_path / 'weather.db'}")
    init_schema_v0(engine)
    repo = WeatherRepo(engine)
    service = WeatherService(repo, provider=FailingHourlyProvider([]))

    result = service.get_dayparts(location_id="pohang", target_date="2026-06-07")

    assert result["ok"] is True
    assert result["weather_dayparts_available"] is False
    assert result["weather_unavailable_reason"] == "Weather info not available."
