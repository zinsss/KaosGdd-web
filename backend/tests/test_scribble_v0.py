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
