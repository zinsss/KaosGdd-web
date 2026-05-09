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


def test_scribble_defaults_to_empty_without_item(main_module) -> None:
    payload = main_module.get_scribble()

    assert payload["ok"] is True
    assert payload["item"]["key"] == "default"
    assert payload["item"]["body"] == ""
    assert payload["item"]["updated_at"] is None


def test_scribble_update_persists_single_default_record(main_module) -> None:
    saved = main_module.update_scribble({"body": "messy\ntext"})

    assert saved["ok"] is True
    assert saved["item"]["key"] == "default"
    assert saved["item"]["body"] == "messy\ntext"
    assert saved["item"]["updated_at"]

    loaded = main_module.get_scribble()
    assert loaded["item"]["body"] == "messy\ntext"

    cleared = main_module.update_scribble({"body": ""})
    assert cleared["ok"] is True
    assert main_module.get_scribble()["item"]["body"] == ""


def test_scribble_does_not_appear_in_notes_journals_or_tasks(main_module) -> None:
    main_module.update_scribble({"body": "not a normal item"})

    assert main_module.list_tasks()["items"] == []
    assert main_module.list_notes()["items"] == []
    assert main_module.list_journals()["items"] == []
