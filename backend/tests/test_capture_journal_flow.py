from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "capture-journal-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_minimal_journal_succeeds(main_module) -> None:
    payload = main_module.capture_item({"raw": "// exhausted after clinic"})

    assert payload["ok"] is True
    assert payload["kind"] == "journal"

    detail = main_module.get_journal(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["body"] == "exhausted after clinic"


def test_capture_multiline_journal_succeeds(main_module) -> None:
    raw = "// long day\none patient stayed in my mind\n#work #clinic"
    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True

    detail = main_module.get_journal(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["body"] == "long day\none patient stayed in my mind"
    assert sorted(detail["item"]["tags"]) == ["clinic", "work"]


def test_capture_empty_journal_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "//"})

    assert payload["ok"] is False
    assert payload["error"] == "journal content is required"


@pytest.mark.parametrize("meta_line", ["r:2026-04-15 09:00", "d:2026-04-15", "R:everyday"])
def test_capture_journal_rejects_unsupported_metadata(main_module, meta_line: str) -> None:
    payload = main_module.capture_item({"raw": f"// remember to call lab\n{meta_line}"})

    assert payload["ok"] is False
    assert payload["error"] == "journal does not support r:, d:, or R:"


def test_journal_raw_round_trip_and_newest_first(main_module) -> None:
    first = main_module.capture_item({"raw": "// first note\n#alpha"})
    second = main_module.capture_item({"raw": "// second note\nline two\n#beta"})

    raw = main_module.get_journal_raw(second["id"])
    assert raw["ok"] is True
    assert raw["raw"] == "// second note\nline two\n#beta"

    patch = main_module.update_journal_raw(second["id"], {"raw": "// second note edited\nline three\n#gamma"})
    assert patch["ok"] is True

    detail = main_module.get_journal(second["id"])
    assert detail["item"]["body"] == "second note edited\nline three"
    assert detail["item"]["tags"] == ["gamma"]

    listed = main_module.list_journals()
    assert listed["items"][0]["id"] == second["id"]
    assert listed["items"][1]["id"] == first["id"]
