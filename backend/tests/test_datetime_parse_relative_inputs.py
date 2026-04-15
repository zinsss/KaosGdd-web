from __future__ import annotations

from datetime import datetime

import pytest

from app.utils import datetime_parse
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.task_raw import parse_task_raw


def _freeze_now(monkeypatch: pytest.MonkeyPatch, now_utc_iso: str) -> None:
    fixed_now = datetime.fromisoformat(now_utc_iso)
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)


def test_today_defaults_to_1030(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("today") == "2026-04-15T01:30:00+00:00"


def test_tomorrow_defaults_to_1030(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("tomorrow") == "2026-04-16T01:30:00+00:00"


def test_plus_3d_defaults_to_1030(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("+3d") == "2026-04-18T01:30:00+00:00"


def test_plus_3d_with_time(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("+3d 09:00") == "2026-04-18T00:00:00+00:00"


def test_time_only_defaults_to_today(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("09:00") == "2026-04-15T00:00:00+00:00"


def test_explicit_local_datetime_still_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("2026-04-20 09:15") == "2026-04-20T00:15:00+00:00"


def test_past_resolved_datetime_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T02:00:00+00:00")
    with pytest.raises(ValueError, match="resolved datetime is in the past"):
        parse_local_datetime_to_iso("today", allow_past=False)


def test_unsupported_natural_language_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    with pytest.raises(ValueError, match="invalid datetime format: next friday"):
        parse_local_datetime_to_iso("next friday")


def test_task_d_and_r_use_same_datetime_normalization(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw("-- Example\nd:+2d\nr:+2d")

    assert parsed["due_at"] == "2026-04-17T01:30:00+00:00"
    assert parsed["remind_ats"] == ["2026-04-17T01:30:00+00:00"]
