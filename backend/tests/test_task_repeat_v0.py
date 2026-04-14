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
