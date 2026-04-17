from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest
import time


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


def test_capture_trigger_colon_triple_returns_note_modal(main_module) -> None:
    payload = main_module.capture_item({"raw": ":::"})

    assert payload["ok"] is True
    assert payload["kind"] == "modal"
    assert payload["modal_type"] == "note"


def test_note_minimal_canonical_template_parse_succeeds(main_module) -> None:
    raw = ":::\ntitle: insurance follow-up\ntags:\nlink:\n:::"

    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is True

    detail = main_module.get_note(created["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "insurance follow-up"
    assert detail["item"]["body"] == ""
    assert detail["item"]["tags"] == []
    assert detail["item"]["links"] == []


def test_note_full_parse_tags_links_body_succeeds(main_module) -> None:
    task = main_module.capture_item({"raw": "-- parent task"})
    raw = "\n".join(
        [
            ":::",
            "title: Insurance Follow-up",
            "tags: Insurance, WORK",
            f"link: {task['id']}, {task['id']}",
            ":::",
            "",
            "# Call insurer",
            "Need claim number.",
        ]
    )

    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is True

    detail = main_module.get_note(created["id"])
    assert detail["item"]["title"] == "Insurance Follow-up"
    assert detail["item"]["tags"] == ["insurance", "work"]
    assert len(detail["item"]["links"]) == 1
    assert detail["item"]["body"] == "# Call insurer\nNeed claim number."


def test_note_malformed_metadata_block_fails(main_module) -> None:
    payload = main_module.create_note_from_raw({"raw": ":::\ntitle: bad"})
    assert payload["ok"] is False
    assert payload["error"] == "note metadata block must be closed with :::"


def test_note_unknown_metadata_key_fails(main_module) -> None:
    payload = main_module.create_note_from_raw({"raw": ":::\ntitle: ok\nowner: me\n:::"})
    assert payload["ok"] is False
    assert payload["error"] == "unsupported note metadata key: owner"


def test_note_tags_normalize_to_lowercase(main_module) -> None:
    raw = ":::\ntitle: t\ntags: Work, work, HOME\nlink:\n:::"
    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is True

    detail = main_module.get_note(created["id"])
    assert detail["item"]["tags"] == ["home", "work"]


def test_note_links_deduplicate(main_module) -> None:
    task = main_module.capture_item({"raw": "-- parent task"})
    raw = f":::\ntitle: t\ntags:\nlink: {task['id']}, {task['id']}\n:::"

    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is True

    detail = main_module.get_note(created["id"])
    assert len(detail["item"]["links"]) == 1


def test_note_link_to_reminder_target_is_rejected(main_module) -> None:
    reminder = main_module.capture_item({"raw": "!! 2026-12-15 23:38 check"})
    raw = f":::\ntitle: t\ntags:\nlink: {reminder['id']}\n:::"

    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is False
    assert created["error"] == "l: cannot target reminder items"


def test_note_canonical_raw_export_round_trip(main_module) -> None:
    raw = ":::\ntitle: alpha\ntags: x, y\nlink:\n:::\n\nbody line"
    created = main_module.create_note_from_raw({"raw": raw})
    assert created["ok"] is True

    raw_payload = main_module.get_note_raw(created["id"])
    assert raw_payload["ok"] is True
    assert raw_payload["raw"] == ":::\ntitle: alpha\ntags: x, y\nlink:\n:::\n\nbody line"

    patched = main_module.update_note_raw(
        created["id"],
        {
            "raw": ":::\ntitle: beta\ntags:\nlink:\n:::\n\nupdated",
        },
    )
    assert patched["ok"] is True

    detail = main_module.get_note(created["id"])
    assert detail["item"]["title"] == "beta"
    assert detail["item"]["body"] == "updated"


def test_notes_list_orders_by_updated_at_newest_first(main_module) -> None:
    first = main_module.create_note_from_raw({"raw": ":::\ntitle: one\ntags:\nlink:\n:::\n\nfirst"})
    second = main_module.create_note_from_raw({"raw": ":::\ntitle: two\ntags:\nlink:\n:::\n\nsecond"})
    assert first["ok"] and second["ok"]

    time.sleep(1.1)
    updated = main_module.update_note_raw(second["id"], {"raw": ":::\ntitle: two\ntags:\nlink:\n:::\n\nsecond updated"})
    assert updated["ok"] is True

    listed = main_module.list_notes()
    assert listed["items"][0]["id"] == second["id"]


def test_note_body_may_be_empty(main_module) -> None:
    created = main_module.create_note_from_raw({"raw": ":::\ntitle: empty body\ntags:\nlink:\n:::"})
    assert created["ok"] is True
    detail = main_module.get_note(created["id"])
    assert detail["item"]["body"] == ""


def test_note_snippet_comes_from_body_not_metadata(main_module) -> None:
    created = main_module.create_note_from_raw(
        {
            "raw": ":::\ntitle: metadata title\ntags: one\nlink:\n:::\n\nactual snippet line",
        }
    )
    assert created["ok"] is True

    listed = main_module.list_notes()
    target = next(item for item in listed["items"] if item["id"] == created["id"])
    assert target["snippet"] == "actual snippet line"
