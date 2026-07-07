from __future__ import annotations

import importlib
import os
from datetime import datetime
from pathlib import Path

import pytest

from app.utils import datetime_parse
from app.utils.task_raw import REPEAT_TAG_PREFIX


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "task-recurrence-edit-v0-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    fixed_now = datetime.fromisoformat("2026-06-01T00:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def _create_grouped_task(main_module, *, title: str, due_at: str, group_id: str, sequence: int) -> str:
    item_id = main_module.items_repo.create_item("task", title)
    main_module.task_repo.create_task(
        item_id,
        due_at=due_at,
        recurrence_group_id=group_id,
        recurrence_sequence=sequence,
    )
    main_module.items_repo.replace_item_tags(item_id, [f"{REPEAT_TAG_PREFIX}daily"])
    return item_id


def _create_three_task_series(main_module) -> tuple[str, str, str]:
    created = main_module.capture_item({"raw": "-- Medicine\nd:2026-06-01T09:00:00+00:00\nR:daily\n--- dose"})
    assert created["ok"] is True
    first_id = created["id"]
    first = main_module.get_task(first_id)["item"]
    group_id = first["recurrence_group_id"]
    assert group_id
    second_id = _create_grouped_task(
        main_module,
        title="Medicine",
        due_at="2026-06-02T09:00:00+00:00",
        group_id=group_id,
        sequence=1,
    )
    third_id = _create_grouped_task(
        main_module,
        title="Medicine",
        due_at="2026-06-03T09:00:00+00:00",
        group_id=group_id,
        sequence=2,
    )
    return first_id, second_id, third_id


def test_current_only_edit_modifies_only_selected_task(main_module) -> None:
    first_id, second_id, third_id = _create_three_task_series(main_module)

    updated = main_module.update_task_raw(
        first_id,
        {"raw": "-- Vitamins\nd:2026-06-01T10:00:00+00:00\nR:daily\n--- dose", "edit_scope": "current_only"},
    )

    assert updated["ok"] is True
    assert main_module.get_task(first_id)["item"]["title"] == "Vitamins"
    assert main_module.get_task(second_id)["item"]["title"] == "Medicine"
    assert main_module.get_task(third_id)["item"]["title"] == "Medicine"
    assert main_module.get_task(first_id)["item"]["recurrence_history"] == []


def test_this_and_future_modifies_future_active_recurrence_instances(main_module) -> None:
    first_id, second_id, third_id = _create_three_task_series(main_module)

    updated = main_module.update_task_raw(
        first_id,
        {
            "raw": "-- Vitamins\nd:2026-06-01T10:00:00+00:00\nR:weekly\n#health\n--- dose\n--- water\n\"\"\"\nwith food\n\"\"\"",
            "edit_scope": "this_and_future",
        },
    )

    assert updated["ok"] is True
    first = main_module.get_task(first_id)["item"]
    second = main_module.get_task(second_id)["item"]
    third = main_module.get_task(third_id)["item"]
    assert [first["title"], second["title"], third["title"]] == ["Vitamins", "Vitamins", "Vitamins"]
    assert [first["due_at"], second["due_at"], third["due_at"]] == [
        "2026-06-01T10:00:00+00:00",
        "2026-06-02T10:00:00+00:00",
        "2026-06-03T10:00:00+00:00",
    ]
    assert [first["repeat_rule"], second["repeat_rule"], third["repeat_rule"]] == ["weekly", "weekly", "weekly"]
    assert second["tags"] == ["health"]
    assert second["memo"] == "with food"
    assert [subtask["content"] for subtask in second["subtasks"]] == ["dose", "water"]


def test_done_past_recurrence_instances_are_untouched(main_module) -> None:
    first_id, second_id, third_id = _create_three_task_series(main_module)
    assert main_module.toggle_task(first_id)["ok"] is True

    updated = main_module.update_task_raw(
        second_id,
        {"raw": "-- Future title\nd:2026-06-02T11:00:00+00:00\nR:daily", "edit_scope": "this_and_future"},
    )

    assert updated["ok"] is True
    assert main_module.get_task(first_id)["item"]["title"] == "Medicine"
    assert main_module.get_task(second_id)["item"]["title"] == "Future title"
    assert main_module.get_task(third_id)["item"]["title"] == "Future title"


def test_removed_recurrence_instances_are_untouched(main_module) -> None:
    first_id, second_id, third_id = _create_three_task_series(main_module)
    assert main_module.remove_task(third_id)["ok"] is True

    updated = main_module.update_task_raw(
        first_id,
        {"raw": "-- Updated active\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "this_and_future"},
    )

    assert updated["ok"] is True
    assert main_module.get_task(second_id)["item"]["title"] == "Updated active"
    assert main_module.get_task(third_id)["item"]["title"] == "Medicine"


def test_rollover_preserves_recurrence_group_id(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Rollover\nd:2026-06-01T09:00:00+00:00\nR:daily"})
    assert created["ok"] is True
    original = main_module.get_task(created["id"])["item"]

    assert main_module.toggle_task(created["id"])["ok"] is True

    active = main_module.list_tasks(mode="active")["items"]
    assert len(active) == 1
    next_task = main_module.get_task(active[0]["id"])["item"]
    assert next_task["recurrence_group_id"] == original["recurrence_group_id"]
    assert next_task["recurrence_parent_id"] == created["id"]
    assert next_task["recurrence_sequence"] == 1


def test_this_and_future_creates_history_with_previous_and_new_values(main_module) -> None:
    first_id, _second_id, _third_id = _create_three_task_series(main_module)

    updated = main_module.update_task_raw(
        first_id,
        {"raw": "-- Edited\nd:2026-06-01T10:00:00+00:00\nR:weekly\n#new", "edit_scope": "this_and_future"},
    )

    assert updated["ok"] is True
    history = main_module.get_task(first_id)["item"]["recurrence_history"]
    assert len(history) == 1
    assert history[0]["edit_scope"] == "this_and_future"
    assert history[0]["previous_values"]["title"] == "Medicine"
    assert history[0]["previous_values"]["due_at"] == "2026-06-01T09:00:00+00:00"
    assert history[0]["previous_values"]["repeat_rule"] == "daily"
    assert history[0]["new_values"]["title"] == "Edited"
    assert history[0]["new_values"]["due_at"] == "2026-06-01T10:00:00+00:00"
    assert history[0]["new_values"]["repeat_rule"] == "weekly"
    assert history[0]["new_values"]["tags"] == ["new"]
    assert history[0]["affected_future_count"] == 2


def test_current_only_does_not_create_recurrence_history(main_module) -> None:
    first_id, _second_id, _third_id = _create_three_task_series(main_module)

    updated = main_module.update_task_raw(
        first_id,
        {"raw": "-- Current\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "current_only"},
    )

    assert updated["ok"] is True
    assert main_module.get_task(first_id)["item"]["recurrence_history"] == []


def test_recurrence_history_is_exposed_in_task_detail_payload(main_module) -> None:
    first_id, _second_id, _third_id = _create_three_task_series(main_module)
    assert main_module.update_task_raw(
        first_id,
        {"raw": "-- History visible\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "this_and_future"},
    )["ok"] is True

    detail = main_module.get_task(first_id)

    assert detail["ok"] is True
    history = detail["item"]["recurrence_history"]
    assert len(history) == 1
    assert history[0]["edited_task_id"] == first_id
    assert history[0]["edited_at_display"]


def test_older_repeating_task_without_metadata_fails_safely_for_this_and_future(main_module) -> None:
    old_id = main_module.items_repo.create_item("task", "Old repeat")
    main_module.task_repo.create_task(old_id, due_at="2026-06-01T09:00:00+00:00")
    main_module.items_repo.replace_item_tags(old_id, [f"{REPEAT_TAG_PREFIX}daily"])

    updated = main_module.update_task_raw(
        old_id,
        {"raw": "-- Edited old\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "this_and_future"},
    )

    assert updated["ok"] is False
    assert "recurrence metadata" in updated["error"]
    assert main_module.get_task(old_id)["item"]["title"] == "Old repeat"


def test_older_repeating_task_without_metadata_still_allows_current_only(main_module) -> None:
    old_id = main_module.items_repo.create_item("task", "Old repeat")
    main_module.task_repo.create_task(old_id, due_at="2026-06-01T09:00:00+00:00")
    main_module.items_repo.replace_item_tags(old_id, [f"{REPEAT_TAG_PREFIX}daily"])

    updated = main_module.update_task_raw(
        old_id,
        {"raw": "-- Edited old\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "current_only"},
    )

    assert updated["ok"] is True
    detail = main_module.get_task(old_id)["item"]
    assert detail["title"] == "Edited old"
    assert detail["recurrence_group_id"]
    assert detail["recurrence_history"] == []


def test_recurrence_edits_do_not_create_duplicate_future_tasks(main_module) -> None:
    first_id, _second_id, _third_id = _create_three_task_series(main_module)
    before_ids = {item["id"] for item in main_module.list_tasks(mode="active")["items"]}

    updated = main_module.update_task_raw(
        first_id,
        {"raw": "-- No duplicates\nd:2026-06-01T10:00:00+00:00\nR:daily", "edit_scope": "this_and_future"},
    )

    assert updated["ok"] is True
    after_ids = {item["id"] for item in main_module.list_tasks(mode="active")["items"]}
    assert after_ids == before_ids
