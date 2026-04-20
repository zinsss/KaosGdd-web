from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "capture-task-due-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_task_due_date_multiline_roundtrip(main_module) -> None:
    raw = "-- testing due dates for tasks\nd:2026-04-30"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"
    assert payload.get("id")

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "testing due dates for tasks"
    assert detail["item"]["due_at"] == "2026-04-30T01:30:00+00:00"

    task_raw = main_module.get_task_raw(payload["id"])
    assert task_raw["ok"] is True
    assert task_raw["raw"] == "-- testing due dates for tasks\nd:2026-04-30 10:30"


def test_capture_task_due_date_inline_datetime_roundtrip(main_module) -> None:
    raw = "-- inline due date capture d:2026-04-30 14:00"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"
    assert payload.get("id")

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "inline due date capture"
    assert detail["item"]["due_at"] == "2026-04-30T05:00:00+00:00"

    task_raw = main_module.get_task_raw(payload["id"])
    assert task_raw["ok"] is True
    assert task_raw["raw"] == "-- inline due date capture\nd:2026-04-30 14:00"


def test_capture_task_supports_relative_reminder_days(main_module) -> None:
    raw = "-- testing relative reminders\nd:2026-04-30\nr:-2d"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"
    assert payload.get("id")

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["due_at"] == "2026-04-30T01:30:00+00:00"
    assert len(detail["item"]["reminders"]) == 1
    assert detail["item"]["reminders"][0]["remind_at"] == "2026-04-28"


def test_capture_task_due_datetime_multiline(main_module) -> None:
    raw = "-- 블루팜 위고비 바늘 주사기 원밴드\nd:2026-04-20 14:00"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"
    assert payload.get("id")

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "블루팜 위고비 바늘 주사기 원밴드"
    assert detail["item"]["due_at"] == "2026-04-20T05:00:00+00:00"


def test_capture_task_absolute_reminder_datetime_multiline(main_module) -> None:
    raw = "-- 삼성에어컨 a/s 신청\nr:2026-04-20 13:15"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"
    assert payload.get("id")

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "삼성에어컨 a/s 신청"
    assert len(detail["item"]["reminders"]) == 1
    assert detail["item"]["reminders"][0]["remind_at"] == "2026-04-20T04:15:00+00:00"


def test_capture_task_due_date_multiline(main_module) -> None:
    raw = "-- due date only\nd:2026-04-20"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["due_at"] == "2026-04-20T01:30:00+00:00"


def test_capture_task_relative_reminder_multiline(main_module) -> None:
    raw = "-- relative reminder task\nd:2026-04-20\nr:-1d"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert len(detail["item"]["reminders"]) == 1
    assert detail["item"]["reminders"][0]["remind_at"] == "2026-04-19"


def test_capture_task_rejects_past_resolved_datetime(main_module) -> None:
    payload = main_module.capture_item({"raw": "-- old task\nd:2020-01-01"})
    assert payload["ok"] is False
    assert payload["error"] == "resolved datetime is in the past"

    listed = main_module.list_tasks()
    assert listed["items"] == []


def test_raw_edit_task_allows_existing_past_datetime(main_module) -> None:
    created = main_module.capture_item({"raw": "-- keep overdue editable"})
    assert created["ok"] is True

    patch = main_module.update_task_raw(created["id"], {"raw": "-- keep overdue editable\nd:2020-01-01"})
    assert patch["ok"] is True

    detail = main_module.get_task(created["id"])
    assert detail["ok"] is True
    assert detail["item"]["due_at"] == "2020-01-01T01:30:00+00:00"
