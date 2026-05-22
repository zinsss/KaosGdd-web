from __future__ import annotations

import re
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.utils.item_links import dedupe_links, parse_link_value
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.repeat import normalize_repeat_rule

EVENT_PREFIX = "^^ "
MEMO_DELIM = '"""'
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REL_REMIND_RE = re.compile(r"^-(\d+)([dhwm])$")
TAG_RE = re.compile(r"#([^\s#]+)")
EVENT_REPEAT_RULES = {"weekly", "monthly", "yearly"}
REPEAT_TAG_PREFIX = "repeat:"


def _split_header_date_and_tail(header: str) -> tuple[str, str]:
    body = header[len(EVENT_PREFIX):].strip()
    if not body:
        return "", ""

    range_match = re.match(r"^(\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2})(?:\s+(.*))?$", body)
    if range_match:
        return range_match.group(1), (range_match.group(2) or "").strip()

    single_match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$", body)
    if single_match:
        return single_match.group(1), (single_match.group(2) or "").strip()

    return body, ""


def _expand_inline_tail(inline_tail: str) -> list[str]:
    tail = (inline_tail or "").strip()
    if not tail:
        return []

    marker = re.search(r'\s(?=(?:#|r:|R:|l:|"""))', tail)
    if not marker:
        return [tail]

    title = tail[: marker.start()].strip()
    meta_tail = tail[marker.start() + 1 :].strip()
    parts = [title] if title else []
    parts.extend(token.strip() for token in meta_tail.split() if token.strip())
    return parts


def _validate_date(value: str) -> str:
    if not DATE_RE.match(value):
        raise ValueError("invalid event date format (expected YYYY-MM-DD)")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("invalid event date format (expected YYYY-MM-DD)") from exc
    return value


def normalize_event_repeat_rule(value: str | None) -> str | None:
    rule = normalize_repeat_rule(value)
    if rule is None:
        return None
    if rule not in EVENT_REPEAT_RULES:
        raise ValueError(f"invalid event repeat rule: {value}")
    return rule


def repeat_rule_from_tags(tags: list[str] | None) -> str | None:
    for tag in tags or []:
        clean = str(tag or "").strip().lower()
        if not clean.startswith(REPEAT_TAG_PREFIX):
            continue
        rule = clean[len(REPEAT_TAG_PREFIX):].strip()
        if rule in EVENT_REPEAT_RULES:
            return rule
    return None


def tags_with_event_repeat(tags: list[str] | None, repeat_rule: str | None) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        clean = str(tag or "").strip().lower()
        if not clean or clean.startswith(REPEAT_TAG_PREFIX):
            continue
        if clean in seen:
            continue
        seen.add(clean)
        output.append(clean)

    rule = normalize_event_repeat_rule(repeat_rule)
    if rule:
        output.append(f"{REPEAT_TAG_PREFIX}{rule}")
    return output


def _add_months(source: datetime, months: int) -> datetime:
    month_index = source.month - 1 + months
    year = source.year + (month_index // 12)
    month = (month_index % 12) + 1
    day = min(source.day, monthrange(year, month)[1])
    return source.replace(year=year, month=month, day=day)


def next_event_occurrence_date(start_date: str, repeat_rule: str, count: int = 1) -> str:
    source = datetime.strptime(_validate_date(start_date), "%Y-%m-%d")
    rule = normalize_event_repeat_rule(repeat_rule)
    if rule is None:
        raise ValueError("repeat rule required")
    steps = max(int(count), 0)

    if rule == "weekly":
        return (source + timedelta(weeks=steps)).date().isoformat()
    if rule == "monthly":
        return _add_months(source, steps).date().isoformat()

    year = source.year + steps
    day = min(source.day, monthrange(year, source.month)[1])
    return source.replace(year=year, day=day).date().isoformat()


def _resolve_reminder(remind_raw: str, start_date: str, *, reject_past_datetimes: bool = False) -> str:
    clean = str(remind_raw or "").strip()
    if not clean:
        raise ValueError("malformed r:")

    rel_match = REL_REMIND_RE.match(clean)
    if rel_match:
        amount = int(rel_match.group(1))
        unit = rel_match.group(2)
        base_local = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
        if unit == "d":
            return (base_local - timedelta(days=amount)).date().isoformat()
        if unit == "w":
            return (base_local - timedelta(weeks=amount)).date().isoformat()
        if unit == "h":
            return (base_local - timedelta(hours=amount)).astimezone(timezone.utc).isoformat(timespec="seconds")
        if unit == "m":
            return (base_local - timedelta(minutes=amount)).astimezone(timezone.utc).isoformat(timespec="seconds")
        raise ValueError("malformed r:")

    if DATE_RE.match(clean):
        _validate_date(clean)
        return clean

    try:
        return parse_local_datetime_to_iso(clean, allow_past=not reject_past_datetimes)
    except ValueError as exc:
        raise ValueError("malformed r:") from exc


def parse_event_raw(raw_text: str, *, reject_past_datetimes: bool = False) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("missing date after ^^")

    lines = text.split("\n")
    first = next((line.strip() for line in lines if line.strip()), "")
    if first == "^^":
        raise ValueError("missing date after ^^")
    if not first.startswith(EVENT_PREFIX):
        raise ValueError("event line must start with ^^ ")

    header_value, inline_tail = _split_header_date_and_tail(first)
    if not header_value:
        raise ValueError("missing date after ^^")

    start_date = None
    end_date = None
    header_title = None

    if "~" in header_value:
        parts = [p.strip() for p in header_value.split("~")]
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError("malformed range")
        start_date = _validate_date(parts[0])
        end_date = _validate_date(parts[1])
        if end_date < start_date:
            raise ValueError("end date earlier than start date")
    elif DATE_RE.match(header_value):
        start_date = _validate_date(header_value)
    else:
        header_title = header_value

    first_idx = lines.index(next(line for line in lines if line.strip()))
    rest = lines[first_idx + 1:]
    if inline_tail:
        rest = [*_expand_inline_tail(inline_tail), *rest]

    title = header_title
    tags: list[str] = []
    remind_at = None
    repeat_rule = None
    repeat_seen = False
    linked_item_ids: list[str] = []
    memo_lines: list[str] = []
    in_memo = False

    for original in rest:
        stripped = original.strip()

        if in_memo:
            if stripped == MEMO_DELIM:
                in_memo = False
            else:
                memo_lines.append(original)
            continue

        if not stripped:
            continue

        if start_date is None and stripped.startswith("d:"):
            date_value = stripped[2:].strip()
            if "~" in date_value:
                parts = [p.strip() for p in date_value.split("~")]
                if len(parts) != 2 or not parts[0] or not parts[1]:
                    raise ValueError("malformed range")
                start_date = _validate_date(parts[0])
                end_date = _validate_date(parts[1])
                if end_date < start_date:
                    raise ValueError("end date earlier than start date")
            else:
                start_date = _validate_date(date_value)
            continue

        if title is None:
            if stripped.startswith("#") or stripped.startswith("r:") or stripped.startswith("l:") or stripped == MEMO_DELIM:
                raise ValueError("missing title")
            title = stripped
            continue

        if stripped.startswith("d:"):
            raise ValueError("multiple event dates are not allowed")

        if stripped == MEMO_DELIM:
            in_memo = True
            continue

        if stripped.startswith("#"):
            tags.extend([tag.lower() for tag in TAG_RE.findall(stripped)])
            continue

        if stripped.startswith("r:"):
            if remind_at is not None:
                raise ValueError("malformed r:")
            if not start_date:
                raise ValueError("missing event date")
            remind_at = _resolve_reminder(
                stripped[2:].strip(),
                start_date,
                reject_past_datetimes=reject_past_datetimes,
            )
            continue

        if stripped.startswith("R:"):
            if repeat_seen:
                raise ValueError("multiple R: lines are not allowed")
            raw_repeat = stripped[2:].strip() or None
            repeat_rule = normalize_event_repeat_rule(raw_repeat)
            repeat_seen = True
            continue

        if stripped.startswith("l:"):
            linked_item_ids.append(parse_link_value(stripped[2:]))
            continue

        raise ValueError("unsupported extra event grammar")

    if in_memo:
        raise ValueError('memo block not closed with """')

    if not title:
        raise ValueError("missing title")

    if not start_date:
        raise ValueError("missing event date")

    deduped = []
    seen = set()
    for tag in tags:
        if tag and tag not in seen:
            seen.add(tag)
            deduped.append(tag)

    return {
        "title": title,
        "start_date": start_date,
        "end_date": end_date,
        "memo": "\n".join(memo_lines).rstrip("\n") if memo_lines else None,
        "tags": deduped,
        "repeat_rule": repeat_rule,
        "remind_ats": [remind_at] if remind_at else [],
        "linked_item_ids": dedupe_links(linked_item_ids),
    }


def export_event_raw(
    event: dict,
    *,
    tags: list[str] | None = None,
    remind_at: str | None = None,
    linked_item_ids: list[str] | None = None,
) -> str:
    date_line = event.get("start_date") or ""
    if event.get("end_date"):
        date_line += f"~{event['end_date']}"

    lines = [f"^^ {date_line}", str(event.get("title") or "").strip()]

    if tags:
        visible_tags = [tag for tag in tags if not str(tag or "").strip().lower().startswith(REPEAT_TAG_PREFIX)]
        if visible_tags:
            lines.append(" ".join(f"#{tag}" for tag in visible_tags if str(tag).strip()))

    repeat_rule = event.get("repeat_rule") or repeat_rule_from_tags(tags)
    if repeat_rule:
        lines.append(f"R:{repeat_rule}")

    if remind_at:
        lines.append(f"r:{remind_at}")

    for target_item_id in dedupe_links(list(linked_item_ids or [])):
        lines.append(f"l:{target_item_id}")

    memo = str(event.get("memo") or "").strip("\n")
    if memo:
        lines.append(MEMO_DELIM)
        lines.extend(str(event.get("memo") or "").splitlines())
        lines.append(MEMO_DELIM)

    return "\n".join(lines).strip()
