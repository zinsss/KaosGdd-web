from __future__ import annotations

from datetime import date, datetime, timedelta

from app.utils.event_raw import next_event_occurrence_date, normalize_event_repeat_rule

MAX_OCCURRENCE_EXPANSION_STEPS = 1000
MAX_OCCURRENCES_PER_EVENT = 500


def _parse_date(value: str) -> date:
    return datetime.strptime(str(value), "%Y-%m-%d").date()


def _event_duration_days(event: dict) -> int:
    start = _parse_date(str(event.get("start_date")))
    end_value = event.get("end_date") or event.get("start_date")
    end = _parse_date(str(end_value))
    return max((end - start).days, 0)


def _overlaps(start: date, end: date, range_start: date, range_end: date) -> bool:
    return start <= range_end and end >= range_start


def expand_recurring_event(
    event: dict,
    *,
    range_start: str,
    range_end: str,
    repeat_rule: str,
    max_steps: int = MAX_OCCURRENCE_EXPANSION_STEPS,
    max_occurrences: int = MAX_OCCURRENCES_PER_EVENT,
) -> list[dict]:
    rule = normalize_event_repeat_rule(repeat_rule)
    if rule is None:
        return []

    window_start = _parse_date(range_start)
    window_end = _parse_date(range_end)
    if window_end < window_start:
        return []

    canonical_start = _parse_date(str(event.get("start_date")))
    if canonical_start > window_end:
        return []

    duration = _event_duration_days(event)
    occurrences: list[dict] = []
    sequence = 0
    cursor = canonical_start

    while cursor <= window_end:
        occurrence_end = cursor + timedelta(days=duration)
        if _overlaps(cursor, occurrence_end, window_start, window_end):
            item = dict(event)
            item["canonical_event_id"] = event.get("id")
            item["occurrence_sequence"] = sequence
            item["occurrence_id"] = f"{event.get('id')}:{cursor.isoformat()}"
            item["start_date"] = cursor.isoformat()
            item["end_date"] = occurrence_end.isoformat() if duration else None
            item["is_recurring_occurrence"] = sequence > 0
            occurrences.append(item)
            if len(occurrences) >= max_occurrences:
                break

        sequence += 1
        if sequence >= max_steps:
            break
        next_date = _parse_date(next_event_occurrence_date(str(event.get("start_date")), rule, sequence))
        if next_date <= cursor:
            break
        cursor = next_date

    return occurrences
