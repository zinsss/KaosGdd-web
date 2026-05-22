from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "scribble-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_scribble_defaults_to_empty_card_list(main_module) -> None:
    payload = main_module.list_scribbles()

    assert payload["ok"] is True
    assert payload["items"] == []


def test_scribble_create_persists_separate_cards(main_module) -> None:
    first = main_module.create_scribble({"body": "messy\ntext"})
    second = main_module.create_scribble({"body": "another unknown capture"})

    assert first["ok"] is True
    assert first["item"]["id"]
    assert first["item"]["body"] == "messy\ntext"
    assert first["item"]["created_at"]
    assert first["item"]["updated_at"]
    assert first["item"]["sort_order"] == 1

    assert second["ok"] is True
    assert second["item"]["body"] == "another unknown capture"
    assert second["item"]["sort_order"] == 2

    loaded = main_module.list_scribbles()
    assert [item["body"] for item in loaded["items"]] == ["another unknown capture", "messy\ntext"]


def test_scribble_update_and_delete_apply_to_one_card(main_module) -> None:
    keep = main_module.create_scribble({"body": "keep me"})["item"]
    edit = main_module.create_scribble({"body": "draft"})["item"]

    updated = main_module.update_scribble(edit["id"], {"body": "edited draft"})
    assert updated["ok"] is True
    assert updated["item"]["id"] == edit["id"]
    assert updated["item"]["body"] == "edited draft"
    assert updated["item"]["created_at"] == edit["created_at"]

    deleted = main_module.delete_scribble(edit["id"])
    assert deleted["ok"] is True

    loaded = main_module.list_scribbles()
    assert [item["id"] for item in loaded["items"]] == [keep["id"]]


def test_scribble_does_not_appear_in_notes_journals_or_tasks(main_module) -> None:
    main_module.create_scribble({"body": "not a normal item"})

    assert main_module.list_tasks()["items"] == []
    assert main_module.list_notes()["items"] == []
    assert main_module.list_journals()["items"] == []


def test_global_capture_scribble_same_line_creates_scribble(main_module) -> None:
    payload = main_module.capture_item({"raw": "... Need to figure out insurance thing"})

    assert payload["ok"] is True
    assert payload["kind"] == "scribble"

    loaded = main_module.list_scribbles()
    assert loaded["items"][0]["body"] == "Need to figure out insurance thing"
    assert loaded["items"][0]["raw"] == "... Need to figure out insurance thing"


def test_global_capture_scribble_multiline_creates_scribble(main_module) -> None:
    payload = main_module.capture_item({"raw": "...\nNeed to figure out insurance thing\nCall clinic"})

    assert payload["ok"] is True

    loaded = main_module.list_scribbles()
    assert loaded["items"][0]["body"] == "Need to figure out insurance thing\nCall clinic"
    assert loaded["items"][0]["raw"] == "...\nNeed to figure out insurance thing\nCall clinic"


def test_global_capture_empty_scribble_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "..."})

    assert payload["ok"] is False
    assert payload["error"] == "scribble content is required"


def test_scribble_module_plain_text_creates_scribble(main_module) -> None:
    payload = main_module.create_scribble({"body": "Need to figure out insurance thing"})

    assert payload["ok"] is True
    assert payload["kind"] == "scribble"
    assert payload["item"]["body"] == "Need to figure out insurance thing"
    assert payload["item"]["raw"] == "... Need to figure out insurance thing"


def test_global_capture_plain_text_does_not_create_scribble_implicitly(main_module) -> None:
    payload = main_module.capture_item({"raw": "Need to figure out insurance thing"})

    assert payload["ok"] is False
    assert payload["error"] == "unsupported prefix"
    assert main_module.list_scribbles()["items"] == []


def test_scribble_tags_parse_and_store(main_module) -> None:
    first = main_module.capture_item({"raw": "... Need insurance #insurance #clinic #insurance"})
    second = main_module.create_scribble({"body": "Need clinic\n#clinic #health"})

    assert first["ok"] is True
    assert second["ok"] is True

    loaded = main_module.list_scribbles()["items"]
    assert loaded[1]["body"] == "Need insurance"
    assert loaded[1]["tags"] == ["insurance", "clinic"]
    assert loaded[1]["raw"] == "... Need insurance #insurance #clinic"
    assert loaded[0]["body"] == "Need clinic"
    assert loaded[0]["tags"] == ["clinic", "health"]
    assert loaded[0]["raw"] == "... Need clinic #clinic #health"


def test_scribble_unsupported_metadata_fails_safely(main_module) -> None:
    due_payload = main_module.capture_item({"raw": "...\nNeed insurance\nd:2026-06-01"})
    reminder_payload = main_module.create_scribble({"body": "Need insurance\nr:2026-06-01 10:00"})
    repeat_payload = main_module.create_scribble({"body": "Need insurance\nR:daily"})

    assert due_payload["ok"] is False
    assert due_payload["error"] == "scribble does not support d:, r:, or R:"
    assert reminder_payload["ok"] is False
    assert reminder_payload["error"] == "scribble does not support d:, r:, or R:"
    assert repeat_payload["ok"] is False
    assert repeat_payload["error"] == "scribble does not support d:, r:, or R:"
    assert main_module.list_scribbles()["items"] == []
