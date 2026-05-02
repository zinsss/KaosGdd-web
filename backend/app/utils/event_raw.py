from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.utils.item_links import dedupe_links, parse_link_value
from app.utils.datetime_parse import parse_local_datetime_to_iso

EVENT_PREFIX = "^^ "
MEMO_DELIM = '"""'
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REL_REMIND_RE = re.compile(r"^-(\d+)([dhwm])$")
TAG_RE = re.compile(r"#([^\s#]+)")


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

    marker = re.search(r'\s(?=(?:#|r:|l:|"""))', tail)
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

    date_part, inline_tail = _split_header_date_and_tail(first)
    if not date_part:
        raise ValueError("missing date after ^^")

    if "~" in date_part:
        parts = [p.strip() for p in date_part.split("~")]
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError("malformed range")
        start_date = _validate_date(parts[0])
        end_date = _validate_date(parts[1])
        if end_date < start_date:
            raise ValueError("end date earlier than start date")
    else:
        start_date = _validate_date(date_part)
        end_date = None

    first_idx = lines.index(next(line for line in lines if line.strip()))
    rest = lines[first_idx + 1:]
    if inline_tail:
        rest = [*_expand_inline_tail(inline_tail), *rest]

    title = None
    tags: list[str] = []
    remind_at = None
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

        if title is None:
            if stripped.startswith("#") or stripped.startswith("r:") or stripped.startswith("l:") or stripped == MEMO_DELIM:
                raise ValueError("missing title")
            title = stripped
            continue

        if stripped == MEMO_DELIM:
            in_memo = True
            continue

        if stripped.startswith("#"):
            tags.extend([tag.lower() for tag in TAG_RE.findall(stripped)])
            continue

        if stripped.startswith("r:"):
            if remind_at is not None:
                raise ValueError("malformed r:")
            remind_at = _resolve_reminder(
                stripped[2:].strip(),
                start_date,
                reject_past_datetimes=reject_past_datetimes,
            )
            continue

        if stripped.startswith("l:"):
            linked_item_ids.append(parse_link_value(stripped[2:]))
            continue

        raise ValueError("unsupported extra event grammar")

    if in_memo:
        raise ValueError('memo block not closed with """')

    if not title:
        raise ValueError("missing title")

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
        lines.append(" ".join(f"#{tag}" for tag in tags if str(tag).strip()))

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
