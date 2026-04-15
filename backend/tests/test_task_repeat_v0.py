from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest

from app.utils.task_raw import export_task_raw, parse_task_raw


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "task-repeat-v0-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_with_repeat_line_succeeds(main_module) -> None:
    raw = "-- Pay rent\nd:2026-05-01\nR:monthly"

    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "task"

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["repeat_rule"] == "monthly"

    task_raw = main_module.get_task_raw(payload["id"])
    assert task_raw["ok"] is True
    assert "R:monthly" in task_raw["raw"]


def test_task_raw_roundtrip_preserves_repeat_rule() -> None:
    raw = "-- Water plants\nR:weekly\n#home"

    parsed = parse_task_raw(raw)
    exported = export_task_raw(
        {"title": parsed["title"], "is_done": parsed["is_done"], "due_at": parsed["due_at"], "memo": parsed["memo"]},
        tags=parsed["tags"],
        remind_ats=parsed["remind_ats"],
        repeat_rule=parsed["repeat_rule"],
        subtasks=parsed["subtasks"],
    )

    assert parsed["repeat_rule"] == "weekly"
    assert parsed["tags"] == ["home"]
    assert exported == raw


def test_invalid_repeat_rule_fails_clearly(main_module) -> None:
    payload = main_module.capture_item({"raw": "-- Pay rent\nR:fortnightly"})

    assert payload["ok"] is False
    assert payload["error"] == "invalid repeat rule: fortnightly"


def test_multiple_repeat_lines_fail_clearly(main_module) -> None:
    payload = main_module.capture_item({"raw": "-- Pay rent\nR:monthly\nR:yearly"})

    assert payload["ok"] is False
    assert payload["error"] == "multiple R: lines are not allowed"


def test_subtask_metadata_rejects_repeat() -> None:
    with pytest.raises(ValueError, match="subtask metadata is not allowed"):
        parse_task_raw("-- Parent task\n--- child R:daily")


def test_repeat_survives_update_from_raw(main_module) -> None:
    create = main_module.capture_item({"raw": "-- Morning meds\nR:daily"})
    assert create["ok"] is True
    task_id = create["id"]

    update = main_module.update_task_raw(task_id, {"raw": "-- Morning meds\nd:2026-05-01\nR:yearly"})
    assert update["ok"] is True

    detail = main_module.get_task(task_id)
    assert detail["ok"] is True
    assert detail["item"]["repeat_rule"] == "yearly"

    exported = main_module.get_task_raw(task_id)
    assert exported["ok"] is True
    assert "R:yearly" in exported["raw"]


def test_non_repeat_task_behavior_unchanged(main_module) -> None:
    raw = "-- Plain task\n#one"
    payload = main_module.capture_item({"raw": raw})
    assert payload["ok"] is True

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["repeat_rule"] is None
    assert detail["item"]["tags"] == ["one"]

    exported = main_module.get_task_raw(payload["id"])
    assert exported["ok"] is True
    assert "R:" not in exported["raw"]


def test_completion_non_repeating_task_does_not_create_new_task(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Plain\nd:2026-04-15 10:30"})
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    done_items = main_module.list_tasks(mode="done")["items"]
    active_items = main_module.list_tasks(mode="active")["items"]

    assert len(done_items) == 1
    assert done_items[0]["id"] == created["id"]
    assert active_items == []


def test_completion_daily_repeating_task_creates_next_instance(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Daily standup\nd:2026-04-15T10:30:00+00:00\nR:daily"})
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(active_items) == 1
    assert active_items[0]["title"] == "Daily standup"
    assert active_items[0]["due_at"] == "2026-04-16T10:30:00+00:00"
    assert active_items[0]["repeat_rule"] == "daily"
    assert active_items[0]["is_done"] == 0


def test_completion_weekly_repeating_task_creates_next_instance(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Weekly review\nd:2026-04-15T10:30:00+00:00\nR:weekly"})
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(active_items) == 1
    assert active_items[0]["due_at"] == "2026-04-22T10:30:00+00:00"
    assert active_items[0]["repeat_rule"] == "weekly"


def test_rollover_copies_memo_tags_and_repeat_rule(main_module) -> None:
    created = main_module.capture_item(
        {
            "raw": '-- Deep work\nd:2026-04-15T10:30:00+00:00\nR:monthly\n#focus #work\n"""\nno interruptions\n"""'
        }
    )
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(active_items) == 1
    new_task = main_module.get_task(active_items[0]["id"])["item"]
    assert new_task["memo"] == "no interruptions"
    assert new_task["tags"] == ["focus", "work"]
    assert new_task["repeat_rule"] == "monthly"


def test_rollover_copies_subtasks_and_resets_to_undone(main_module) -> None:
    created = main_module.capture_item(
        {
            "raw": "-- Parent\nd:2026-04-15T10:30:00+00:00\nR:daily\n--- first child\n--x completed child"
        }
    )
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(active_items) == 1
    new_task = main_module.get_task(active_items[0]["id"])["item"]
    assert [subtask["content"] for subtask in new_task["subtasks"]] == ["first child", "completed child"]
    assert all(subtask["is_done"] == 0 for subtask in new_task["subtasks"])
    assert all(subtask["done_at"] is None for subtask in new_task["subtasks"])


def test_rollover_does_not_copy_reminder_history(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Bills\nd:2026-04-15T10:30:00+00:00\nR:daily"})
    assert created["ok"] is True
    task_id = created["id"]

    reminder_create = main_module.create_task_reminder(task_id, {"remind_at": "2026-04-15T09:30:00+00:00"})
    assert reminder_create["ok"] is True
    reminder_id = reminder_create["id"]
    main_module.reminder_repo.mark_fired(reminder_id)
    main_module.reminder_repo.mark_acked(reminder_id)

    toggled = main_module.toggle_task(task_id)
    assert toggled["ok"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(active_items) == 1
    new_task = main_module.get_task(active_items[0]["id"])["item"]
    assert new_task["reminders"] == []


def test_repeat_task_without_due_date_does_not_rollover(main_module) -> None:
    created = main_module.capture_item({"raw": "-- No due\nR:daily"})
    assert created["ok"] is True

    toggled = main_module.toggle_task(created["id"])
    assert toggled["ok"] is True

    done_items = main_module.list_tasks(mode="done")["items"]
    active_items = main_module.list_tasks(mode="active")["items"]
    assert len(done_items) == 1
    assert active_items == []


def test_toggling_done_back_to_undone_does_not_create_another_instance(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Back and forth\nd:2026-04-15T10:30:00+00:00\nR:daily"})
    assert created["ok"] is True

    first_toggle = main_module.toggle_task(created["id"])
    assert first_toggle["ok"] is True
    assert first_toggle["is_done"] is True

    active_after_first = main_module.list_tasks(mode="active")["items"]
    assert len(active_after_first) == 1
    first_new_id = active_after_first[0]["id"]

    second_toggle = main_module.toggle_task(created["id"])
    assert second_toggle["ok"] is True
    assert second_toggle["is_done"] is False

    active_after_second = main_module.list_tasks(mode="active")["items"]
    assert len(active_after_second) == 2
    assert [item["id"] for item in active_after_second].count(first_new_id) == 1
