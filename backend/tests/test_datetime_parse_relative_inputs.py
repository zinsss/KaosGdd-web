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


def test_plus_3d_is_relative_duration_from_now(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("+3d") == "2026-04-18T00:00:00+00:00"


def test_plus_3d_with_time(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    assert parse_local_datetime_to_iso("+3d 09:00") == "2026-04-18T00:00:00+00:00"


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("+2m", "2026-06-08T06:22:00+00:00"),
        ("+10m", "2026-06-08T06:30:00+00:00"),
        ("+1h", "2026-06-08T07:20:00+00:00"),
        ("+2d", "2026-06-10T06:20:00+00:00"),
    ],
)
def test_compact_relative_offsets_resolve_from_local_now(
    raw_value: str, expected: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _freeze_now(monkeypatch, "2026-06-08T06:20:00+00:00")  # 15:20 in Asia/Seoul
    assert parse_local_datetime_to_iso(raw_value) == expected


@pytest.mark.parametrize("raw_value", ["+0m", "-2m", "+1w", "+1mo"])
def test_invalid_compact_relative_offsets_are_rejected(
    raw_value: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _freeze_now(monkeypatch, "2026-06-08T06:20:00+00:00")
    with pytest.raises(ValueError, match="invalid datetime format"):
        parse_local_datetime_to_iso(raw_value)


def test_task_due_and_reminder_accept_compact_relative_offsets(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-06-08T06:20:00+00:00")

    due_minutes = parse_task_raw("-- Test\nd:+2m")
    reminder_minutes = parse_task_raw("-- Test\nr:+10m")
    due_hours = parse_task_raw("-- Test\nd:+1h")
    reminder_days = parse_task_raw("-- Test\nr:+2d")

    assert due_minutes["due_at"] == "2026-06-08T06:22:00+00:00"
    assert reminder_minutes["remind_ats"] == ["2026-06-08T06:30:00+00:00"]
    assert due_hours["due_at"] == "2026-06-08T07:20:00+00:00"
    assert reminder_days["remind_ats"] == ["2026-06-10T06:20:00+00:00"]


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


def test_time_only_one_minute_future_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-18T10:28:00+00:00")  # 19:28 in Asia/Seoul
    assert parse_local_datetime_to_iso("19:29", allow_past=False) == "2026-04-18T10:29:00+00:00"


def test_time_only_future_second_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-18T10:28:00+00:00")  # 19:28 in Asia/Seoul
    assert parse_local_datetime_to_iso("19:28:30", allow_past=False) == "2026-04-18T10:28:30+00:00"


def test_time_only_past_minute_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-18T10:28:00+00:00")  # 19:28 in Asia/Seoul
    with pytest.raises(ValueError, match="resolved datetime is in the past"):
        parse_local_datetime_to_iso("19:27", allow_past=False)


def test_capture_uses_provided_local_timezone(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-19T02:28:00+00:00")  # 19:28 in America/Los_Angeles
    assert parse_local_datetime_to_iso(
        "2026-04-18 19:29",
        allow_past=False,
        timezone_name="America/Los_Angeles",
    ) == "2026-04-19T02:29:00+00:00"


def test_task_d_and_r_use_same_datetime_normalization(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw("-- Example\nd:+2d\nr:+2d")

    assert parsed["due_at"] == "2026-04-17T01:30:00+00:00"
    assert parsed["remind_ats"] == ["2026-04-17T01:30:00+00:00"]


def test_task_dr_uses_same_datetime_normalization(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw("-- Example\ndr:+3d 09:00")

    assert parsed["due_at"] == "2026-04-18T00:00:00+00:00"
    assert parsed["remind_ats"] == ["2026-04-18T00:00:00+00:00"]


def test_task_dr_time_only_defaults_to_today_without_tomorrow_rollover(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw("-- Example\ndr:17:00")

    assert parsed["due_at"] == "2026-04-15T08:00:00+00:00"
    assert parsed["remind_ats"] == ["2026-04-15T08:00:00+00:00"]


def test_task_inline_dr_full_datetime_sets_due_and_reminder(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw("-- Call clinic dr:2026-05-08 17:00")

    assert parsed["title"] == "Call clinic"
    assert parsed["due_at"] == "2026-05-08T08:00:00+00:00"
    assert parsed["remind_ats"] == ["2026-05-08T08:00:00+00:00"]


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("2026-05-08", "2026-05-08T01:30:00+00:00"),
        ("17:00", "2026-04-15T08:00:00+00:00"),
        ("today", "2026-04-15T01:30:00+00:00"),
        ("tomorrow", "2026-04-16T01:30:00+00:00"),
        ("+3d", "2026-04-18T00:00:00+00:00"),
        ("+3d 09:00", "2026-04-18T00:00:00+00:00"),
    ],
)
def test_task_inline_dr_shorthand_forms(raw_value: str, expected: str, monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")
    parsed = parse_task_raw(f"-- Call clinic dr:{raw_value}")

    assert parsed["title"] == "Call clinic"
    assert parsed["due_at"] == expected
    assert parsed["remind_ats"] == [expected]


def test_task_dr_rejects_explicit_due_or_reminder_ambiguity(monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze_now(monkeypatch, "2026-04-15T00:00:00+00:00")

    with pytest.raises(ValueError, match="dr: cannot be combined with d: or r:"):
        parse_task_raw("-- Example\ndr:tomorrow\nr:tomorrow")

    with pytest.raises(ValueError, match="dr: cannot be combined with d: or r:"):
        parse_task_raw("-- Example\nd:tomorrow\ndr:tomorrow")

    with pytest.raises(ValueError, match="dr: cannot be combined with d: or r:"):
        parse_task_raw("-- Call clinic dr:tomorrow d:tomorrow")

    with pytest.raises(ValueError, match="dr: cannot be combined with d: or r:"):
        parse_task_raw("-- Call clinic dr:tomorrow r:tomorrow")
