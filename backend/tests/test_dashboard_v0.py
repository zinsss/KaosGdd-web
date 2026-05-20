from __future__ import annotations

import importlib
import os
from datetime import datetime
from pathlib import Path

import pytest

from app.integrations.holiday_ical_provider import Holiday


class FakeHolidayProvider:
    def __init__(self, holidays: list[Holiday]) -> None:
        self.holidays = holidays

    def fetch_holidays(self, *, start_year: int, end_year: int) -> list[Holiday]:
        return self.holidays


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "dashboard-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.core.db as db_module
    import app.engine.dashboard_service as dashboard_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(dashboard_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    monkeypatch.setattr(dashboard_module, "_local_now", lambda: datetime.fromisoformat("2026-01-10T09:00:00+09:00"))
    yield main_module
    main_module.stop_holiday_sync_scheduler()


def test_dashboard_returns_compact_shared_view_model(main_module) -> None:
    main_module.holiday_sync_service.provider = FakeHolidayProvider(
        [Holiday(external_id="uid-public", uid="uid-public", title="Public Day", start_date="2026-01-10")]
    )
    main_module.holiday_sync_service.sync_years(start_year=2026, end_year=2026)
    imported = [
        event for event in main_module.event_service.list_events_in_range(
            start_date="2026-01-10",
            end_date="2026-01-10",
        )
        if event.get("is_imported_calendar_event")
    ][0]
    main_module.update_event_classification(imported["id"], {"is_public_holiday": True})

    main_module.event_service.create_event(title="Tomorrow event", start_date="2026-01-11")
    main_module.task_service.create_task("Overdue task", due_at="2026-01-09T10:00:00+09:00")
    main_module.task_service.create_task("Today task", due_at="2026-01-10T10:00:00+09:00")
    main_module.task_service.create_task("Floating task")
    main_module.reminder_service.create_standalone_reminder(
        title="Today reminder",
        remind_at="2026-01-10T12:00:00+09:00",
    )

    payload = main_module.get_dashboard()

    assert payload["date"] == "2026-01-10"
    assert payload["date_display"] == "2026.01.10 Sat"
    assert payload["task_counts"] == {"overdue": 1, "today": 1, "active_total": 3}
    assert payload["flags"]["is_public_holiday"] is True
    assert payload["flags"]["is_market_saturday"] is True
    assert payload["flags"]["is_claim_day"] is False
    assert {event["title"] for event in payload["today_events"]} >= {"Public Day", "Market Saturday"}
    assert "Tomorrow event" in [event["title"] for event in payload["upcoming_events"]]
    assert [reminder["title"] for reminder in payload["today_reminders"]] == ["Today reminder"]
