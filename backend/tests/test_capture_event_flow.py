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
