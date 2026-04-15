from __future__ import annotations

from app.utils.task_raw import parse_task_raw


def test_task_relative_reminder_units_from_due_day() -> None:
    parsed = parse_task_raw("-- Task\nd:2026-05-09\nr:-2d\nr:-1w\nr:-2h\nr:-30m")

    assert parsed["due_at"] == "2026-05-09T01:30:00+00:00"
    assert parsed["remind_ats"] == [
        "2026-05-07",
        "2026-05-02",
        "2026-05-08T13:00:00+00:00",
        "2026-05-08T14:30:00+00:00",
    ]
