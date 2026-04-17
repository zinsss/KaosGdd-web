from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "capture-note-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_minimal_note_succeeds(main_module) -> None:
    payload = main_module.capture_item({"raw": ":: buy insulin refill"})

    assert payload["ok"] is True
    assert payload["kind"] == "note"

    detail = main_module.get_note(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["body"] == "buy insulin refill"
    assert detail["item"]["title"] == "buy insulin refill"


def test_capture_markdown_note_renders_as_raw_markdown(main_module) -> None:
    raw = ":: # Weekly prep\n- [ ] Call pharmacy\n- [x] Update bag"
    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True

    detail = main_module.get_note(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["body"] == "# Weekly prep\n- [ ] Call pharmacy\n- [x] Update bag"
    assert detail["item"]["title"] == "Weekly prep"


def test_capture_empty_note_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "::"})

    assert payload["ok"] is False
    assert payload["error"] == "note content is required"


def test_note_raw_round_trip_and_list_order(main_module) -> None:
    first = main_module.capture_item({"raw": ":: first note"})
    second = main_module.capture_item({"raw": ":: second note"})

    raw = main_module.get_note_raw(second["id"])
    assert raw["ok"] is True
    assert raw["raw"] == "second note"

    patch = main_module.update_note_raw(second["id"], {"raw": "# second note edited\nline three"})
    assert patch["ok"] is True

    detail = main_module.get_note(second["id"])
    assert detail["item"]["body"] == "# second note edited\nline three"
    assert detail["item"]["title"] == "second note edited"

    listed = main_module.list_notes()
    listed_ids = {row["id"] for row in listed["items"]}
    assert first["id"] in listed_ids
    assert second["id"] in listed_ids
