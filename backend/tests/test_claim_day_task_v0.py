from __future__ import annotations

import importlib
import os
from datetime import date
from pathlib import Path

import pytest

from app.engine import claim_day_task_service as claim_module


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "claim-day-task-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["APP_TIMEZONE"] = "Asia/Seoul"
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    yield main_module
    main_module.stop_holiday_sync_scheduler()


def _create_claim_day(main_module, claim_date: str) -> str:
    item_id = main_module.event_service.create_event(title="Claim Day", start_date=claim_date)
    main_module.items_repo.replace_item_tags(
        item_id,
        ["system:custom-calendar", "readonly", "event-class:claim-day"],
    )
    return item_id


def _task_items(main_module, mode: str = "active") -> list[dict]:
    return main_module.list_tasks(mode=mode)["items"]


def _claim_task(main_module, task_id: str) -> dict:
    payload = main_module.get_task(task_id)
    assert payload["ok"] is True
    return payload["item"]


def test_non_claim_day_skips_and_creates_no_task(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-30"))

    payload = main_module.internal_ensure_claim_day_task()

    assert payload == {"ok": True, "created": False, "skipped": True, "reason": "not claim day"}
    assert _task_items(main_module) == []


def test_claim_day_creates_task_with_due_reminders_and_tags(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))

    payload = main_module.internal_ensure_claim_day_task()

    assert payload["ok"] is True
    assert payload["created"] is True
    assert payload["skipped"] is False
    assert payload.get("id")

    task = _claim_task(main_module, payload["id"])
    assert task["title"] == "청구하기"
    assert task["due_at"] == "2026-05-31T13:00:00+00:00"
    assert {"claim-day", "auto"}.issubset(set(task["tags"]))
    assert not any(tag.startswith("claim-day-task:") for tag in task["tags"])
    assert [reminder["remind_at"] for reminder in task["reminders"]] == [
        "2026-05-31T11:00:00+00:00",
        "2026-05-31T12:00:00+00:00",
    ]

    raw = main_module.get_task_raw(payload["id"])["raw"]
    assert raw == "\n".join(
        [
            "-- 청구하기",
            "d:2026-05-31 22:00",
            "r:2026-05-31 20:00",
            "r:2026-05-31 21:00",
            "#auto #claim-day",
        ]
    )


def test_repeated_call_same_claim_day_creates_no_duplicate(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))

    first = main_module.internal_ensure_claim_day_task()
    second = main_module.internal_ensure_claim_day_task()

    assert first["created"] is True
    assert second["ok"] is True
    assert second["created"] is False
    assert second["skipped"] is True
    assert second["reason"] == "already exists"
    assert second["id"] == first["id"]
    assert [task["title"] for task in _task_items(main_module)] == ["청구하기"]


def test_raw_edit_preserves_hidden_dedupe_marker(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))
    first = main_module.internal_ensure_claim_day_task()

    ok, error = main_module.task_service.update_task_from_raw(
        first["id"],
        "-- 청구하기 updated\nd:2026-05-31 22:00\nr:2026-05-31 20:00\n#claim-day #auto #edited",
        timezone_name="Asia/Seoul",
    )
    second = main_module.internal_ensure_claim_day_task()

    assert ok is True
    assert error is None
    internal_tags = main_module.items_repo.list_item_tags(first["id"])
    assert internal_tags.count("claim-day-task:2026-05-31") == 1
    assert not any(tag.startswith("claim-day-task:") for tag in _claim_task(main_module, first["id"])["tags"])
    assert "claim-day-task:" not in main_module.get_task_raw(first["id"])["raw"]
    assert second["created"] is False
    assert second["reason"] == "already exists"
    assert second["id"] == first["id"]


def test_next_claim_day_can_create_new_task(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    _create_claim_day(main_module, "2026-06-05")

    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))
    first = main_module.internal_ensure_claim_day_task()

    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-06-05"))
    second = main_module.internal_ensure_claim_day_task()

    assert first["created"] is True
    assert second["created"] is True
    assert first["id"] != second["id"]
    assert len(_task_items(main_module)) == 2
    assert _claim_task(main_module, second["id"])["due_at"] == "2026-06-05T13:00:00+00:00"


def test_existing_manual_task_without_dedupe_marker_does_not_block_automation(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    manual_id = main_module.task_service.create_task("청구하기")
    main_module.task_service.update_task_from_raw(
        manual_id,
        "-- 청구하기\nd:2026-05-31 22:00\nr:2026-05-31 20:00\nr:2026-05-31 21:00\n#claim-day #auto",
        timezone_name="Asia/Seoul",
    )
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))

    payload = main_module.internal_ensure_claim_day_task()

    assert payload["created"] is True
    assert payload["id"] != manual_id
    assert len(_task_items(main_module)) == 2


def test_raw_setup_failure_hard_deletes_temporary_task(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))
    monkeypatch.setattr(claim_module, "claim_day_task_raw", lambda claim_date: "-- broken\nd:not-a-date")

    payload = main_module.internal_ensure_claim_day_task()

    assert payload["ok"] is False
    assert payload["created"] is False
    assert payload["skipped"] is True
    assert payload["reason"] == "raw setup failed"
    assert payload["error"]
    assert _task_items(main_module, "active") == []
    assert _task_items(main_module, "removed") == []


def test_completed_auto_task_still_blocks_same_day_duplicate(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))
    first = main_module.internal_ensure_claim_day_task()
    main_module.toggle_task(first["id"])

    second = main_module.internal_ensure_claim_day_task()

    assert second["created"] is False
    assert second["reason"] == "already exists"
    assert len(_task_items(main_module, "done")) == 1
    assert _task_items(main_module, "active") == []


def test_existing_dedupe_marker_returns_already_exists(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _create_claim_day(main_module, "2026-05-31")
    item_id = main_module.task_service.create_task("청구하기")
    main_module.items_repo.replace_item_tags(item_id, ["claim-day-task:2026-05-31"])
    monkeypatch.setattr(claim_module, "_local_today", lambda: date.fromisoformat("2026-05-31"))

    payload = main_module.internal_ensure_claim_day_task()

    assert payload == {
        "ok": True,
        "created": False,
        "skipped": True,
        "reason": "already exists",
        "id": item_id,
    }
