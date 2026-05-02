from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "capture-event-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


@pytest.mark.parametrize(
    "raw",
    [
        "^^ 2026-05-09\n주열NP",
        "^^ 2026-05-09   \n\n주열NP",
        "^^ 2026-05-09 주열NP",
        "^^ 2026-05-09 주열NP #family r:-2d",
    ],
)
def test_capture_event_minimal_forms_succeed(main_module, raw: str) -> None:
    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is True
    assert payload["kind"] == "event"
    assert payload.get("id")

    detail = main_module.get_event(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "주열NP"
    assert detail["item"]["start_date"] == "2026-05-09"


@pytest.mark.parametrize(
    "raw",
    [
        "^^ 2026-05-09\n#family",
        "^^ 2026-05-09\nr:-2d",
        '^^ 2026-05-09\n"""\nmemo\n"""',
    ],
)
def test_capture_event_rejects_metadata_as_title(main_module, raw: str) -> None:
    payload = main_module.capture_item({"raw": raw})

    assert payload["ok"] is False
    assert payload["error"] == "missing title"


def test_capture_event_rejects_past_resolved_reminder(main_module) -> None:
    payload = main_module.capture_item({"raw": "^^ 2026-05-09\nEvent\nr:2020-01-01 09:00"})

    assert payload["ok"] is False
    assert payload["error"] == "malformed r:"


def test_raw_edit_event_allows_existing_past_reminder(main_module) -> None:
    created = main_module.capture_item({"raw": "^^ 2026-05-09\nEvent"})
    assert created["ok"] is True

    patch = main_module.update_event_raw(created["id"], {"raw": "^^ 2026-05-09\nEvent\nr:2020-01-01 09:00"})
    assert patch["ok"] is True

    detail = main_module.get_event(created["id"])
    assert detail["ok"] is True
    assert len(detail["item"]["reminders"]) == 1
    assert detail["item"]["reminders"][0]["remind_at"] == "2020-01-01T00:00:00+00:00"


def test_capture_event_single_line_with_l_metadata(main_module) -> None:
    target = main_module.capture_item({"raw": "-- linked task"})
    assert target["ok"] is True

    payload = main_module.capture_item({"raw": f"^^ 2026-05-09 Mom birthday l:{target['id']} #family r:-1w"})
    assert payload["ok"] is True

    detail = main_module.get_event(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "Mom birthday"
    assert [link["id"] for link in detail["item"]["links"]] == [target["id"]]
