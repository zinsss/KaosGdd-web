from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta

VALID_REPEAT_RULES = {"daily", "weekly", "monthly", "yearly"}


def normalize_repeat_rule(value: str | None) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in VALID_REPEAT_RULES:
        raise ValueError(f"invalid repeat rule: {value}")
    return raw


def compute_next_due_at(due_at: str, repeat_rule: str) -> str:
    due_dt = datetime.fromisoformat(str(due_at))
    rule = normalize_repeat_rule(repeat_rule)
    if rule is None:
        raise ValueError("repeat rule required")

    if rule == "daily":
        return (due_dt + timedelta(days=1)).isoformat(timespec="seconds")

    if rule == "weekly":
        return (due_dt + timedelta(weeks=1)).isoformat(timespec="seconds")

    if rule == "monthly":
        year = due_dt.year
        month = due_dt.month + 1
        if month > 12:
            month = 1
            year += 1
        last_day = monthrange(year, month)[1]
        day = min(due_dt.day, last_day)
        return due_dt.replace(year=year, month=month, day=day).isoformat(timespec="seconds")

    next_year = due_dt.year + 1
    last_day = monthrange(next_year, due_dt.month)[1]
    day = min(due_dt.day, last_day)
    return due_dt.replace(year=next_year, day=day).isoformat(timespec="seconds")
