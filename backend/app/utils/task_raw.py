from __future__ import annotations

import re

from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.timefmt import format_dt_for_ui

REPEAT_TAG_PREFIX = "repeat:"


def _extract_meta_from_line(line: str) -> tuple[str, dict]:
    working = str(line or "")
    meta = {
        "due_at": None,
        "remind_ats": [],
        "repeat_rule": None,
        "tags": [],
    }

    due_match = re.search(r"(?:(?<=^)|(?<=\s))d:(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})", working)
    if due_match:
        meta["due_at"] = due_match.group(1).strip()
        working = working.replace(due_match.group(0), " ")

    remind_matches = re.findall(r"(?:(?<=^)|(?<=\s))r:(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})", working)
    if remind_matches:
        meta["remind_ats"] = [value.strip() for value in remind_matches]
        working = re.sub(r"(?:(?<=^)|(?<=\s))r:(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})", " ", working)

    repeat_match = re.search(r"(?:(?<=^)|(?<=\s))R:([^\s]+)", working)
    if repeat_match:
        meta["repeat_rule"] = repeat_match.group(1).strip()
        working = working.replace(repeat_match.group(0), " ")

    tags = re.findall(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", working)
    if tags:
        meta["tags"] = [tag.strip().lower() for tag in tags if tag.strip()]
        working = re.sub(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", " ", working)

    cleaned = " ".join(working.split())
    return cleaned, meta


def export_task_raw(
    task: dict,
    *,
    tags: list[str] | None = None,
    remind_ats: list[str] | None = None,
    repeat_rule: str | None = None,
) -> str:
    lines: list[str] = []

    title = str(task.get("title") or "").strip()
    if title:
        lines.append(title)

    due_at = str(task.get("due_at") or "").strip()
    if due_at:
        due_display = format_dt_for_ui(due_at)
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

    memo = task.get("memo")
    if memo is not None and str(memo).strip():
        lines.append("")
        lines.append('"""')
        lines.extend(str(memo).splitlines())
        lines.append('"""')

    return "\n".join(lines)


def parse_task_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("title is required")

    lines = text.split("\n")

    title = None
    due_at = None
    remind_ats: list[str] = []
    repeat_rule = None
    tags: list[str] = []
    extra_lines: list[str] = []
    memo_lines: list[str] = []
    in_memo = False

    for original_line in lines:
        line = original_line.rstrip("\n")
        stripped = line.strip()

        if in_memo:
            if stripped == '"""':
                in_memo = False
            else:
                memo_lines.append(original_line)
            continue

        if not stripped:
            continue

        if stripped == '"""':
            in_memo = True
            continue

        cleaned, meta = _extract_meta_from_line(original_line)

        if meta["due_at"] is not None:
            due_at = parse_local_datetime_to_iso(meta["due_at"])

        for remind_at in meta["remind_ats"]:
            normalized = parse_local_datetime_to_iso(remind_at)
            if normalized not in remind_ats:
                remind_ats.append(normalized)

        if meta["repeat_rule"] is not None:
            repeat_rule = meta["repeat_rule"]

        if meta["tags"]:
            for tag in meta["tags"]:
                if tag not in tags:
                    tags.append(tag)

        if title is None:
            candidate = cleaned.strip()
            if candidate.startswith("- "):
                candidate = candidate[2:].strip()
            title = candidate or None
            continue

        if cleaned.strip():
            extra_lines.append(cleaned.strip())

    if in_memo:
        raise ValueError("unclosed memo block")

    if not title:
        raise ValueError("title is required")

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
        "memo": memo,
    }