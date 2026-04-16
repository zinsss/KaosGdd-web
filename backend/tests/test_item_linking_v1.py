from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "item-linking-v1.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def _create_task(main_module, raw: str) -> str:
    created = main_module.capture_item({"raw": raw})
    assert created["ok"] is True
    return created["id"]


def _create_event(main_module, raw: str) -> str:
    created = main_module.capture_item({"raw": raw})
    assert created["ok"] is True
    return created["id"]


def _create_journal(main_module, raw: str) -> str:
    created = main_module.capture_item({"raw": raw})
    assert created["ok"] is True
    return created["id"]


def test_task_raw_with_l_creates_links(main_module) -> None:
    target_a = _create_task(main_module, "-- linked task a")
    target_b = _create_task(main_module, "-- linked task b")
    source = _create_task(main_module, "-- source task")

    patch = main_module.update_task_raw(source, {"raw": f"-- source task\nl:{target_a}\nl:{target_b}"})
    assert patch["ok"] is True

    detail = main_module.get_task(source)
    assert detail["ok"] is True
    assert [link["id"] for link in detail["item"]["links"]] == sorted([target_a, target_b])


def test_event_raw_with_l_creates_links(main_module) -> None:
    target = _create_task(main_module, "-- linked to event")
    event_id = _create_event(main_module, "^^ 2026-08-14\nMom birthday")

    patch = main_module.update_event_raw(event_id, {"raw": f"^^ 2026-08-14\nMom birthday\nl:{target}"})
    assert patch["ok"] is True

    detail = main_module.get_event(event_id)
    assert detail["ok"] is True
    assert detail["item"]["links"][0]["id"] == target


def test_journal_raw_with_l_creates_links(main_module) -> None:
    target = _create_task(main_module, "-- linked to journal")
    journal_id = _create_journal(main_module, "// rough day")

    patch = main_module.update_journal_raw(journal_id, {"raw": f"// rough day\nl:{target}"})
    assert patch["ok"] is True

    detail = main_module.get_journal(journal_id)
    assert detail["ok"] is True
    assert detail["item"]["links"][0]["id"] == target


def test_raw_export_includes_canonical_l_lines(main_module) -> None:
    target = _create_task(main_module, "-- export target")
    source = _create_task(main_module, "-- export source")

    patch = main_module.update_task_raw(source, {"raw": f"-- export source\nl:{target}"})
    assert patch["ok"] is True

    raw = main_module.get_task_raw(source)
    assert raw["ok"] is True
    assert raw["raw"].split("\n")[-1] == f"l:{target}"


def test_duplicate_l_lines_are_deduplicated(main_module) -> None:
    target = _create_task(main_module, "-- dedupe target")
    source = _create_task(main_module, "-- dedupe source")

    patch = main_module.update_task_raw(source, {"raw": f"-- dedupe source\nl:{target}\nl:{target}"})
    assert patch["ok"] is True

    detail = main_module.get_task(source)
    assert detail["ok"] is True
    assert len(detail["item"]["links"]) == 1


def test_self_link_is_rejected(main_module) -> None:
    source = _create_task(main_module, "-- self source")

    patch = main_module.update_task_raw(source, {"raw": f"-- self source\nl:{source}"})
    assert patch["ok"] is False
    assert patch["error"] == "self-link is invalid"


def test_malformed_or_empty_l_is_rejected(main_module) -> None:
    source = _create_task(main_module, "-- malformed source")

    malformed = main_module.update_task_raw(source, {"raw": "-- malformed source\nl:abc,def"})
    assert malformed["ok"] is False
    assert malformed["error"] == "malformed l:"

    empty = main_module.update_task_raw(source, {"raw": "-- malformed source\nl:"})
    assert empty["ok"] is False
    assert empty["error"] == "empty l: is invalid"


def test_l_on_reminders_is_rejected(main_module) -> None:
    created = main_module.capture_item({"raw": "!! 2026-12-15 23:38\nstandalone"})
    assert created["ok"] is True

    patch = main_module.update_reminder(created["id"], {"raw": "!! 2026-12-15 23:38\nstandalone\nl:abc123"})
    assert patch["ok"] is False
    assert patch["error"] == "standalone reminder does not support l:"


def test_l_on_subtasks_is_rejected(main_module) -> None:
    source = _create_task(main_module, "-- parent")

    patch = main_module.update_task_raw(source, {"raw": "-- parent\n--- child l:abc123"})
    assert patch["ok"] is False
    assert patch["error"] == "subtask metadata is not allowed"


def test_updating_raw_replaces_old_link_set(main_module) -> None:
    a = _create_task(main_module, "-- replace a")
    b = _create_task(main_module, "-- replace b")
    source = _create_task(main_module, "-- replace source")

    first = main_module.update_task_raw(source, {"raw": f"-- replace source\nl:{a}"})
    assert first["ok"] is True

    second = main_module.update_task_raw(source, {"raw": f"-- replace source\nl:{b}"})
    assert second["ok"] is True

    detail = main_module.get_task(source)
    assert detail["ok"] is True
    assert [link["id"] for link in detail["item"]["links"]] == [b]
