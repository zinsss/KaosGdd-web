from __future__ import annotations

import importlib
import os
from datetime import datetime, timezone
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "capture-endpoint-task-metadata.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module
    import app.utils.datetime_parse as datetime_parse_module

    importlib.reload(db_module)
    importlib.reload(datetime_parse_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)

    fixed_now = datetime(2026, 4, 20, 6, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(datetime_parse_module, "_current_utc_now", lambda: fixed_now)

    return main_module


def test_capture_endpoint_accepts_multiline_task_metadata_from_bottom_capture(main_module) -> None:

    cases = [
        ("-- 삼성에어컨 a/s 접수\nd:2026-04-20", "due_at", "2026-04-20T17:30:00+00:00"),
        ("-- 삼성에어컨 a/s 접수\nd:2026-04-20 14:00", "due_at", "2026-04-20T21:00:00+00:00"),
        ("-- 삼성에어컨 a/s 접수\nr:2026-04-20 13:09", "remind_at", "2026-04-20T20:09:00+00:00"),
        ("-- 삼성에어컨 a/s 접수\nr:tomorrow", "remind_at", "2026-04-20T17:30:00+00:00"),
    ]

    for raw, field, expected_iso in cases:
        payload = main_module.capture_item(
            {
                "raw": raw,
                "timezone": "America/Los_Angeles",
            }
        )
        assert payload["ok"] is True
        assert payload["kind"] == "task"

        detail = main_module.get_task(payload["id"])
        assert detail["ok"] is True

        if field == "due_at":
            assert detail["item"]["due_at"] == expected_iso
            continue

        reminders = detail["item"]["reminders"]
        assert len(reminders) == 1
        assert reminders[0]["remind_at"] == expected_iso
