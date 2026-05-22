from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest
from sqlalchemy import text

from app.config import DbTables
from app.utils.event_raw import parse_event_raw


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "event-recurrence-v0-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.core.db as db_module
    import app.engine.dashboard_service as dashboard_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(dashboard_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    yield main_module, dashboard_module, monkeypatch
    main_module.stop_holiday_sync_scheduler()


def _capture_event(main_module, raw: str) -> str:
    payload = main_module.capture_item({"raw": raw})
    assert payload["ok"] is True, payload
    assert payload["kind"] == "event"
    return payload["id"]


def _events(main_module, start_date: str, end_date: str) -> list[dict]:
    return main_module.event_service.list_events_in_range(start_date=start_date, end_date=end_date)


def _event_item_count(main_module) -> int:
    with main_module.engine.begin() as conn:
        return int(conn.execute(text(f"SELECT COUNT(*) FROM {DbTables.EVENT_ITEMS}")).scalar_one())


def test_weekly_recurring_event_appears_in_later_weekly_ranges(main_module) -> None:
    module, _, _ = main_module
    event_id = _capture_event(module, "^^ Garbage day\nd:2026-06-01\nR:weekly")

    events = _events(module, "2026-06-15", "2026-06-15")

    assert [event["title"] for event in events] == ["Garbage day"]
    assert events[0]["id"] == event_id
    assert events[0]["occurrence_id"] == f"{event_id}:2026-06-15"
    assert events[0]["start_date"] == "2026-06-15"
    assert events[0]["repeat_rule"] == "weekly"
    assert events[0]["is_recurring_occurrence"] is True


def test_monthly_recurring_event_appears_correctly(main_module) -> None:
    module, _, _ = main_module
    _capture_event(module, "^^ Rent reminder\nd:2026-06-01\nR:monthly")

    events = _events(module, "2026-08-01", "2026-08-31")

    assert [(event["title"], event["start_date"]) for event in events] == [("Rent reminder", "2026-08-01")]


def test_yearly_recurring_event_appears_correctly(main_module) -> None:
    module, _, _ = main_module
    _capture_event(module, "^^ Mom birthday\nd:2026-08-14\nR:yearly")

    events = _events(module, "2028-08-01", "2028-08-31")

    assert [(event["title"], event["start_date"]) for event in events] == [("Mom birthday", "2028-08-14")]


def test_jan_31_monthly_recurrence_clamps_safely(main_module) -> None:
    module, _, _ = main_module
    _capture_event(module, "^^ Billing marker\nd:2026-01-31\nR:monthly")

    events = _events(module, "2026-02-01", "2026-02-28")

    assert [(event["title"], event["start_date"]) for event in events] == [("Billing marker", "2026-02-28")]


def test_yearly_leap_day_recurrence_clamps_safely(main_module) -> None:
    module, _, _ = main_module
    _capture_event(module, "^^ Leap marker\nd:2024-02-29\nR:yearly")

    events = _events(module, "2025-02-01", "2025-02-28")

    assert [(event["title"], event["start_date"]) for event in events] == [("Leap marker", "2025-02-28")]


def test_recurring_event_appears_in_month_calendar_ranges(main_module) -> None:
    module, _, _ = main_module
    _capture_event(module, "^^ Weekly marker\nd:2026-06-01\nR:weekly")

    events = _events(module, "2026-06-01", "2026-06-30")

    assert [event["start_date"] for event in events] == [
        "2026-06-01",
        "2026-06-08",
        "2026-06-15",
        "2026-06-22",
        "2026-06-29",
    ]


def test_recurring_event_appears_in_dashboard_upcoming_range(main_module) -> None:
    module, dashboard_module, monkeypatch = main_module
    monkeypatch.setattr(
        dashboard_module,
        "_local_now",
        lambda: dashboard_module.datetime.fromisoformat("2026-06-08T09:00:00+09:00"),
    )
    _capture_event(module, "^^ Weekly dashboard\nd:2026-06-01\nR:weekly")

    payload = module.get_dashboard()

    assert [event["title"] for event in payload["today_events"]] == ["Weekly dashboard"]
    upcoming = [(event["title"], event["start_date"]) for event in payload["upcoming_events"]]
    assert ("Weekly dashboard", "2026-06-15") in upcoming


def test_non_recurring_event_behavior_remains_unchanged(main_module) -> None:
    module, _, _ = main_module
    event_id = _capture_event(module, "^^ One time event\nd:2026-06-01\n#family")

    in_range = _events(module, "2026-06-01", "2026-06-01")
    later = _events(module, "2026-06-08", "2026-06-08")
    detail = module.get_event(event_id)["item"]

    assert [(event["title"], event["start_date"], event["repeat_rule"]) for event in in_range] == [
        ("One time event", "2026-06-01", None)
    ]
    assert later == []
    assert detail["tags"] == ["family"]


def test_recurrence_expansion_does_not_create_duplicate_permanent_rows(main_module) -> None:
    module, _, _ = main_module
    event_id = _capture_event(module, "^^ Durable canonical\nd:2026-01-01\nR:monthly")

    first = _events(module, "2026-01-01", "2026-12-31")
    second = _events(module, "2026-01-01", "2026-12-31")

    assert len(first) == 12
    assert len(second) == 12
    assert _event_item_count(module) == 1
    assert {event["id"] for event in first} == {event_id}


def test_event_raw_parses_and_exports_repeat_rule(main_module) -> None:
    module, _, _ = main_module
    parsed = parse_event_raw("^^ Mom birthday\nd:2026-08-14\nR:yearly\n#family")

    assert parsed["title"] == "Mom birthday"
    assert parsed["start_date"] == "2026-08-14"
    assert parsed["repeat_rule"] == "yearly"

    event_id = _capture_event(module, "^^ Mom birthday\nd:2026-08-14\nR:yearly\n#family")
    raw = module.get_event_raw(event_id)["raw"]
    detail = module.get_event(event_id)["item"]

    assert detail["repeat_rule"] == "yearly"
    assert "repeat:yearly" in detail["tags"]
    assert "R:yearly" in raw
    assert "#repeat:yearly" not in raw


def test_daily_event_repeat_is_not_supported(main_module) -> None:
    module, _, _ = main_module

    payload = module.capture_item({"raw": "^^ Standup\nd:2026-06-01\nR:daily"})

    assert payload["ok"] is False
    assert payload["error"] == "invalid event repeat rule: daily"

