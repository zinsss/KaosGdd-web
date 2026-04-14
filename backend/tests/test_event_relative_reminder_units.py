from __future__ import annotations

from app.utils.event_raw import parse_event_raw


def test_event_relative_reminder_days_and_weeks() -> None:
    parsed_days = parse_event_raw("^^ 2026-05-09\nEvent\nr:-2d")
    parsed_weeks = parse_event_raw("^^ 2026-05-09\nEvent\nr:-1w")

    assert parsed_days["remind_ats"] == ["2026-05-07"]
    assert parsed_weeks["remind_ats"] == ["2026-05-02"]


def test_event_relative_reminder_hours_and_minutes() -> None:
    parsed_hours = parse_event_raw("^^ 2026-05-09\nEvent\nr:-2h")
    parsed_minutes = parse_event_raw("^^ 2026-05-09\nEvent\nr:-30m")

    assert parsed_hours["remind_ats"] == ["2026-05-08T13:00:00+00:00"]
    assert parsed_minutes["remind_ats"] == ["2026-05-08T14:30:00+00:00"]
