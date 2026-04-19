from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.utils.item_links import dedupe_links, parse_link_value
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.repeat import normalize_repeat_rule
from app.utils.timefmt import format_dt_for_ui

REPEAT_TAG_PREFIX = "repeat:"
UNDONE_TASK_PREFIX = "-- "
DONE_TASK_PREFIX = "-x "
UNDONE_SUBTASK_PREFIX = "--- "
DONE_SUBTASK_PREFIX = "--x "
MEMO_DELIM = '"""'

META_PATTERN = re.compile(r"(?:^|\s)(d:|r:|R:|l:)")
TAG_PATTERN = re.compile(r"(?:^|\s)#")
DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RELATIVE_REMIND_PATTERN = re.compile(r"^-(\d+)([dhwm])$")
INLINE_DUE_PATTERN = re.compile(r"(?:(?<=^)|(?<=\s))d:(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)")


def _extract_meta_from_line(line: str) -> tuple[str, dict]:
    working = str(line or "")
    meta = {
        "due_at": None,
        "remind_ats": [],
        "repeat_rule": None,
        "tags": [],
    }

    due_match = re.search(r"(?:(?<=^)|(?<=\s))d:([^\s]+(?:\s+\d{2}:\d{2})?)", working)
    if due_match:
        meta["due_at"] = due_match.group(1).strip()
        working = working.replace(due_match.group(0), " ")

    remind_matches = re.findall(r"(?:(?<=^)|(?<=\s))r:([^\s]+(?:\s+\d{2}:\d{2})?)", working)
    if remind_matches:
        meta["remind_ats"] = [value.strip() for value in remind_matches]
        working = re.sub(r"(?:(?<=^)|(?<=\s))r:([^\s]+(?:\s+\d{2}:\d{2})?)", " ", working)

    repeat_match = re.search(r"(?:(?<=^)|(?<=\s))R:([^\s]+)", working)
    if repeat_match:
        meta["repeat_rule"] = normalize_repeat_rule(repeat_match.group(1).strip())
        working = working.replace(repeat_match.group(0), " ")

    tags = re.findall(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", working)
    if tags:
        meta["tags"] = [tag.strip().lower() for tag in tags if tag.strip()]
        working = re.sub(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", " ", working)

    cleaned = " ".join(working.split())
    return cleaned, meta


def _parse_due_value(raw_due: str, *, reject_past_datetimes: bool = False) -> str:
    candidate = str(raw_due or "").strip()
    if not candidate:
        return candidate
    return parse_local_datetime_to_iso(candidate, allow_past=not reject_past_datetimes)


def _resolve_relative_reminder(remind_raw: str, due_at: str | None) -> str:
    clean = str(remind_raw or "").strip()
    match = RELATIVE_REMIND_PATTERN.fullmatch(clean)
    if not match:
        raise ValueError("malformed r:")
    if not due_at:
        raise ValueError("relative r: requires d:")

    amount = int(match.group(1))
    unit = match.group(2)

    if DATE_ONLY_PATTERN.fullmatch(due_at):
        due_midnight_local = datetime.strptime(due_at, "%Y-%m-%d").replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
    else:
        due_dt = datetime.fromisoformat(str(due_at).replace("Z", "+00:00"))
        if due_dt.tzinfo is None:
            due_dt = due_dt.replace(tzinfo=ZoneInfo(SETTINGS.APP_TIMEZONE))
        due_midnight_local = due_dt.astimezone(ZoneInfo(SETTINGS.APP_TIMEZONE)).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    if unit == "d":
        return (due_midnight_local - timedelta(days=amount)).date().isoformat()
    if unit == "w":
        return (due_midnight_local - timedelta(weeks=amount)).date().isoformat()
    if unit == "h":
        return (due_midnight_local - timedelta(hours=amount)).astimezone(timezone.utc).isoformat(timespec="seconds")
    if unit == "m":
        return (due_midnight_local - timedelta(minutes=amount)).astimezone(timezone.utc).isoformat(timespec="seconds")

    raise ValueError("malformed r:")


def _assert_no_subtask_metadata(subtask_text: str) -> None:
    if META_PATTERN.search(subtask_text):
        raise ValueError("subtask metadata is not allowed")
    if TAG_PATTERN.search(subtask_text):
        raise ValueError("subtask metadata is not allowed")
    if MEMO_DELIM in subtask_text:
        raise ValueError("subtask metadata is not allowed")


def export_task_raw(
    task: dict,
    *,
    tags: list[str] | None = None,
    remind_ats: list[str] | None = None,
    repeat_rule: str | None = None,
    linked_item_ids: list[str] | None = None,
    subtasks: list[dict] | None = None,
) -> str:
    lines: list[str] = []

    title = str(task.get("title") or "").strip()
    if title:
        task_prefix = DONE_TASK_PREFIX if bool(task.get("is_done")) else UNDONE_TASK_PREFIX
        lines.append(f"{task_prefix}{title}")

    due_at = str(task.get("due_at") or "").strip()
    if due_at:
        due_display = due_at if DATE_ONLY_PATTERN.fullmatch(due_at) else format_dt_for_ui(due_at)
        if due_display:
            lines.append(f"d:{due_display}")

    for remind_at in remind_ats or []:
        remind_display = format_dt_for_ui(remind_at)
        if remind_display:
            lines.append(f"r:{remind_display}")

    if repeat_rule:
        lines.append(f"R:{repeat_rule}")

    visible_tags = [tag for tag in (tags or []) if tag and not str(tag).startswith(REPEAT_TAG_PREFIX)]
    if visible_tags:
        lines.append(" ".join(f"#{tag}" for tag in visible_tags))

    for target_item_id in dedupe_links(list(linked_item_ids or [])):
        lines.append(f"l:{target_item_id}")

    memo = task.get("memo")
    if memo is not None and str(memo).strip():
        lines.append("")
        lines.append(MEMO_DELIM)
        lines.extend(str(memo).splitlines())
        lines.append(MEMO_DELIM)

    for subtask in subtasks or []:
        content = str(subtask.get("content") or "").strip()
        if not content:
            continue
        prefix = DONE_SUBTASK_PREFIX if bool(subtask.get("is_done")) else UNDONE_SUBTASK_PREFIX
        lines.append(f"{prefix}{content}")

    return "\n".join(lines)


def parse_task_raw(raw_text: str, *, reject_past_datetimes: bool = False) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("title is required")

    lines = text.split("\n")

    title = None
    due_at = None
    remind_ats: list[str] = []
    repeat_rule = None
    repeat_rule_seen = False
    tags: list[str] = []
    linked_item_ids: list[str] = []
    extra_lines: list[str] = []
    memo_lines: list[str] = []
    subtasks: list[dict] = []
    in_memo = False
    parsed_task_done = False
    relative_remind_tokens: list[str] = []

    first_content_line = next((line.strip() for line in lines if line.strip()), None)
    if not first_content_line:
        raise ValueError("title is required")
    if first_content_line.startswith(UNDONE_SUBTASK_PREFIX) or first_content_line.startswith(DONE_SUBTASK_PREFIX):
        raise ValueError("subtask line requires a parent task")
    if first_content_line.startswith(UNDONE_TASK_PREFIX):
        title = first_content_line[len(UNDONE_TASK_PREFIX) :].strip() or None
        parsed_task_done = False
    elif first_content_line.startswith(DONE_TASK_PREFIX):
        title = first_content_line[len(DONE_TASK_PREFIX) :].strip() or None
        parsed_task_done = True
    else:
        raise ValueError("task line must start with -- or -x")

    if not title:
        raise ValueError("title is required")

    inline_due_match = INLINE_DUE_PATTERN.search(title)
    if inline_due_match:
        inline_due_raw = inline_due_match.group(1).strip()
        try:
            due_at = _parse_due_value(inline_due_raw, reject_past_datetimes=reject_past_datetimes)
        except ValueError as exc:
            if str(exc) == "resolved datetime is in the past":
                raise ValueError(str(exc)) from exc
            raise ValueError(f"invalid due format: {inline_due_raw}") from exc
        title = " ".join((title[: inline_due_match.start()] + title[inline_due_match.end() :]).split()) or None
        if not title:
            raise ValueError("title is required")

    seen_first_content = False

    for original_line in lines:
        stripped = original_line.strip()

        if in_memo:
            if stripped == MEMO_DELIM:
                in_memo = False
            else:
                memo_lines.append(original_line)
            continue

        if not stripped:
            continue

        if stripped == MEMO_DELIM:
            in_memo = True
            continue

        if not seen_first_content:
            seen_first_content = True
            continue

        if stripped.startswith(UNDONE_SUBTASK_PREFIX) or stripped.startswith(DONE_SUBTASK_PREFIX):
            if stripped.startswith(DONE_SUBTASK_PREFIX):
                subtask_content = stripped[len(DONE_SUBTASK_PREFIX) :].strip()
                subtask_done = True
            else:
                subtask_content = stripped[len(UNDONE_SUBTASK_PREFIX) :].strip()
                subtask_done = False

            if not subtask_content:
                raise ValueError("subtask title is required")
            _assert_no_subtask_metadata(subtask_content)
            subtasks.append({"content": subtask_content, "is_done": subtask_done, "position": len(subtasks)})
            continue

        if stripped.startswith("l:"):
            linked_item_ids.append(parse_link_value(stripped[2:]))
            continue

        cleaned, meta = _extract_meta_from_line(original_line)

        if meta["due_at"] is not None:
            try:
                due_at = _parse_due_value(meta["due_at"], reject_past_datetimes=reject_past_datetimes)
            except ValueError as exc:
                if str(exc) == "resolved datetime is in the past":
                    raise ValueError(str(exc)) from exc
                raise ValueError(f"invalid due format: {meta['due_at']}") from exc

        for remind_at in meta["remind_ats"]:
            if RELATIVE_REMIND_PATTERN.fullmatch(remind_at):
                relative_remind_tokens.append(remind_at)
                continue
            normalized = parse_local_datetime_to_iso(remind_at, allow_past=not reject_past_datetimes)
            if normalized not in remind_ats:
                remind_ats.append(normalized)

        if meta["repeat_rule"] is not None:
            if repeat_rule_seen:
                raise ValueError("multiple R: lines are not allowed")
            repeat_rule_seen = True
            repeat_rule = meta["repeat_rule"]

        if meta["tags"]:
            for tag in meta["tags"]:
                if tag not in tags:
                    tags.append(tag)

        if cleaned.strip():
            extra_lines.append(cleaned.strip())

    if in_memo:
        raise ValueError("unclosed memo block")

    for relative_token in relative_remind_tokens:
        resolved = _resolve_relative_reminder(relative_token, due_at)
        if resolved not in remind_ats:
            remind_ats.append(resolved)

    memo_parts: list[str] = []
    if extra_lines:
        memo_parts.extend(extra_lines)
    if memo_lines:
        if memo_parts:
            memo_parts.append("")
        memo_parts.extend(memo_lines)

    memo = "\n".join(memo_parts).strip() if memo_parts else None

    return {
        "title": title,
        "due_at": due_at,
        "remind_ats": remind_ats,
        "repeat_rule": repeat_rule,
        "tags": tags,
        "linked_item_ids": dedupe_links(linked_item_ids),
        "memo": memo,
        "subtasks": subtasks,
        "is_done": parsed_task_done,
        "uses_task_prefix": True,
    }
