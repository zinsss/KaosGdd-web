from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "reminder-completed-state.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.config as config_module
    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_due_reminder_fires_normally(main_module) -> None:
    task = main_module.create_task({"title": "normal fire"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    detail = main_module.get_reminder(reminder["id"])
    assert detail["ok"] is True
    assert detail["item"]["state"] == "fired"


def test_task_completion_marks_linked_active_reminders_completed(main_module) -> None:
    task = main_module.create_task({"title": "task completes first"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2099-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    toggled = main_module.toggle_task(task["id"])
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    detail = main_module.get_reminder(reminder["id"])
    assert detail["ok"] is True
    assert detail["item"]["state"] == "completed"


def test_completed_linked_reminder_leaves_active_bucket(main_module) -> None:
    task = main_module.create_task({"title": "active bucket"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2099-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    toggled = main_module.toggle_task(task["id"])
    assert toggled["ok"] is True

    active = main_module.list_reminders("active")
    assert all(item["id"] != reminder["id"] for item in active["items"])


def test_completed_linked_reminder_appears_in_fired_history_bucket(main_module) -> None:
    task = main_module.create_task({"title": "history bucket"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2099-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    toggled = main_module.toggle_task(task["id"])
    assert toggled["ok"] is True

    fired = main_module.list_reminders("fired")
    completed = [item for item in fired["items"] if item["id"] == reminder["id"]]
    assert len(completed) == 1
    assert completed[0]["state"] == "completed"
    assert completed[0]["parent_item_id"] == task["id"]


def test_manually_complete_reminder_moves_to_fired_completed(main_module) -> None:
    task = main_module.create_task({"title": "manual complete"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2099-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    completed = main_module.complete_reminder(reminder["id"])
    assert completed["ok"] is True
    assert completed["status"] == "completed"

    detail = main_module.get_reminder(reminder["id"])
    assert detail["ok"] is True
    assert detail["item"]["state"] == "completed"

    active = main_module.list_reminders("active")
    assert all(item["id"] != reminder["id"] for item in active["items"])

    fired = main_module.list_reminders("fired")
    assert any(item["id"] == reminder["id"] and item["state"] == "completed" for item in fired["items"])
