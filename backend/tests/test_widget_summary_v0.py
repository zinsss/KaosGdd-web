from __future__ import annotations

import importlib
import os
from datetime import datetime
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "widget-summary-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["FILE_STORAGE_DIR"] = str(tmp_path / "uploads")
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.config as config_module
    import app.core.db as db_module
    import app.engine.dashboard_service as dashboard_module
    import app.engine.file_service as file_service_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(file_service_module)
    importlib.reload(dashboard_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    monkeypatch.setattr(dashboard_module, "_local_now", lambda: datetime.fromisoformat("2026-01-10T09:00:00+09:00"))
    yield main_module
    main_module.stop_holiday_sync_scheduler()


def _create_classed_event(main_module, *, title: str, event_class: str) -> str:
    item_id = main_module.event_service.create_event(title=title, start_date="2026-01-10")
    main_module.items_repo.replace_item_tags(
        item_id,
        [
            "system:custom-calendar",
            "readonly",
            f"event-class:{event_class}",
        ],
    )
    return item_id


def test_widget_summary_returns_compact_schema_and_counts(main_module) -> None:
    _create_classed_event(main_module, title="Public Day", event_class="public-holiday")
    _create_classed_event(main_module, title="Market Saturday", event_class="market-saturday")
    _create_classed_event(main_module, title="Claim Day", event_class="claim-day")

    main_module.task_service.create_task("Overdue task", due_at="2026-01-09T10:00:00+09:00")
    main_module.task_service.create_task("Today task", due_at="2026-01-10T10:00:00+09:00")
    main_module.task_service.create_task("Floating task")
    main_module.supply_service.create_supply("Gloves")
    main_module.supply_service.create_supply("Gauze")
    fax_id = main_module.file_service.create_file(original_filename="fax.pdf", mime_type="application/pdf", content=b"fax")
    assert main_module.update_file_raw(fax_id, {"raw": "++ Referral fax\nx:02-1234-5678"})["ok"] is True

    ok, _, today_id = main_module.reminder_service.create_standalone_reminder(
        title="Today reminder",
        remind_at="2026-01-10T12:00:00+09:00",
    )
    assert ok is True
    assert today_id is not None
    ok, _, missed_id = main_module.reminder_service.create_standalone_reminder(
        title="Missed reminder",
        remind_at="2026-01-09T12:00:00+09:00",
    )
    assert ok is True
    assert missed_id is not None
    main_module.reminder_repo.mark_missed(missed_id)
    ok, _, fired_id = main_module.reminder_service.create_standalone_reminder(
        title="Fired reminder",
        remind_at="2026-01-10T08:00:00+09:00",
    )
    assert ok is True
    assert fired_id is not None
    main_module.reminder_repo.mark_fired(fired_id)

    payload = main_module.get_widget_summary()

    assert set(payload) == {"date", "tasks", "reminders", "events_today", "supplies", "fax", "flags"}
    assert payload["date"] == "2026.01.10 Sat"
    assert payload["tasks"] == {"overdue": 1, "today": 1, "active_total": 3}
    assert payload["reminders"] == {"today": 1, "missed": 1, "fired": 1}
    assert payload["supplies"] == {"active_total": 2}
    assert payload["fax"] == {"active_total": 1, "attention": 0}
    assert payload["flags"] == {
        "public_holiday": True,
        "market_day": True,
        "claim_day": True,
    }
    assert {"Public Day", "Market Saturday", "Claim Day"}.issubset(set(payload["events_today"]))

    for group in (payload["tasks"], payload["reminders"], payload["supplies"], payload["fax"]):
        assert all(type(value) is int for value in group.values())
    assert all(type(value) is bool for value in payload["flags"].values())
    assert "today_events" not in payload
    assert "upcoming_events" not in payload
    assert "today_reminders" not in payload
    assert "task_counts" not in payload


def test_widget_summary_truncates_event_titles_and_leaks_no_nested_objects(main_module) -> None:
    for index in range(8):
        main_module.event_service.create_event(title=f"Event {index}", start_date="2026-01-10")

    payload = main_module.get_widget_summary()

    assert len(payload["events_today"]) == 5
    assert all(isinstance(title, str) for title in payload["events_today"])
    assert not any(isinstance(title, dict) for title in payload["events_today"])
