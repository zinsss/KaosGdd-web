from __future__ import annotations

VALID_REPEAT_RULES = {"daily", "weekly", "monthly", "yearly"}


def normalize_repeat_rule(value: str | None) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in VALID_REPEAT_RULES:
        raise ValueError(f"invalid repeat rule: {value}")
    return raw

