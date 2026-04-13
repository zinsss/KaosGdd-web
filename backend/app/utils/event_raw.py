from __future__ import annotations

import re
from datetime import datetime, timedelta

from app.utils.datetime_parse import parse_local_datetime_to_iso

EVENT_PREFIX = "^^"
MEMO_DELIM = '"""'
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REL_REMIND_RE = re.compile(r"^-(\d+)d$")
TAG_RE = re.compile(r"#([^\s#]+)")


def _validate_date(value: str) -> str:
    if not DATE_RE.match(value):
        raise ValueError("invalid event date format (expected YYYY-MM-DD)")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("invalid event date format (expected YYYY-MM-DD)") from exc
    return value


def _resolve_reminder(remind_raw: str, start_date: str) -> str:
    clean = str(remind_raw or "").strip()
    if not clean:
        raise ValueError("malformed r:")

    rel_match = REL_REMIND_RE.match(clean)
    if rel_match:
        days = int(rel_match.group(1))
        base = datetime.strptime(start_date, "%Y-%m-%d")
        target = base - timedelta(days=days)
        return target.date().isoformat()

    if DATE_RE.match(clean):
        _validate_date(clean)
        return clean

    try:
        return parse_local_datetime_to_iso(clean)
    except ValueError as exc:
        raise ValueError("malformed r:") from exc


def parse_event_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("missing date after ^^")

    lines = text.split("\n")
    first = next((line.strip() for line in lines if line.strip()), "")
    if not first.startswith(EVENT_PREFIX):
        raise ValueError("event line must start with ^^")

    date_part = first[len(EVENT_PREFIX):].strip()
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

    rest = lines[lines.index(next(line for line in lines if line.strip())) + 1:]

    title = None
    tags: list[str] = []
    remind_at = None
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
            if stripped.startswith("#") or stripped.startswith("r:") or stripped == MEMO_DELIM:
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
            remind_at = _resolve_reminder(stripped[2:].strip(), start_date)
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
    }


def export_event_raw(event: dict, *, tags: list[str] | None = None, remind_at: str | None = None) -> str:
    date_line = event.get("start_date") or ""
    if event.get("end_date"):
        date_line += f"~{event['end_date']}"

    lines = [f"^^ {date_line}", str(event.get("title") or "").strip()]

    if tags:
        lines.append(" ".join(f"#{tag}" for tag in tags if str(tag).strip()))

    if remind_at:
        lines.append(f"r:{remind_at}")

    memo = str(event.get("memo") or "").strip("\n")
    if memo:
        lines.append(MEMO_DELIM)
        lines.extend(str(event.get("memo") or "").splitlines())
        lines.append(MEMO_DELIM)

    return "\n".join(lines).strip()
