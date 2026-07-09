from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "tasks-v0-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_listed_active_task_id_can_detail_and_toggle(main_module) -> None:
    created = main_module.capture_item({"raw": "-- List detail toggle contract"})
    assert created["ok"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    row = next(item for item in active_items if item["id"] == created["id"])
    task_id = row["id"]

    detail = main_module.get_task(task_id)
    assert detail["ok"] is True
    assert detail["item"]["id"] == task_id

    toggled = main_module.toggle_task(task_id)
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    done_items = main_module.list_tasks(mode="done")["items"]
    assert any(item["id"] == task_id for item in done_items)


def test_listed_active_task_with_subtasks_id_can_detail_and_toggle(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Parent task\n--- child task"})
    assert created["ok"] is True

    active_items = main_module.list_tasks(mode="active")["items"]
    row = next(item for item in active_items if item["id"] == created["id"])
    task_id = row["id"]
    assert row["subtask_total"] == 1

    detail = main_module.get_task(task_id)
    assert detail["ok"] is True
    assert detail["item"]["id"] == task_id
    assert len(detail["item"]["subtasks"]) == 1

    toggled = main_module.toggle_task(task_id)
    assert toggled["ok"] is True
    assert toggled["is_done"] is True

    done_items = main_module.list_tasks(mode="done")["items"]
    assert any(item["id"] == task_id for item in done_items)


def test_health_database_diagnostic_reports_counts_without_secrets(main_module) -> None:
    created = main_module.capture_item({"raw": "-- Health diagnostic task"})
    assert created["ok"] is True
    main_module.family_repo.put_record("family", "tasks", [{"id": "family-task-1"}])

    response = main_module.health()
    diagnostic = response["database"]

    assert diagnostic["dialect"] == "sqlite"
    assert diagnostic["task_count"] == 1
    assert diagnostic["family_record_count"] == 1
    assert "password" not in str(diagnostic).lower()
    assert "://" not in str(diagnostic)
