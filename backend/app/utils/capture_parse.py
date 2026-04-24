from __future__ import annotations

import re

from app.parsers.capture_grammar import parse_capture
from app.utils.datetime_parse import parse_local_datetime_to_iso

TIME_TOKEN_RE = re.compile(r"^\d{2}:\d{2}(?::\d{2})?$")
RELATIVE_DAY_TOKEN_RE = re.compile(r"^\+\d+d$", flags=re.IGNORECASE)
DAY_KEYWORD_TOKEN_RE = re.compile(r"^(today|tomorrow)$", flags=re.IGNORECASE)


def _extract_leading_reminder_datetime(
    title: str,
    *,
    timezone_name: str | None = None,
) -> tuple[str | None, str]:
    normalized_title = " ".join(str(title or "").split())
    if not normalized_title:
        return None, ""

    tokens = normalized_title.split()
    max_tokens = min(2, len(tokens))

    for token_count in range(max_tokens, 0, -1):
        candidate_tokens = tokens[:token_count]
        first_token = candidate_tokens[0]

        if token_count == 2 and not (
            DAY_KEYWORD_TOKEN_RE.fullmatch(first_token)
            or RELATIVE_DAY_TOKEN_RE.fullmatch(first_token)
            or re.fullmatch(r"\d{4}-\d{2}-\d{2}", first_token)
        ):
            continue
        if token_count == 1 and TIME_TOKEN_RE.fullmatch(first_token):
            candidate = first_token
        else:
            candidate = " ".join(candidate_tokens)

        try:
            parse_local_datetime_to_iso(
                candidate,
                allow_past=True,
                timezone_name=timezone_name,
            )
        except ValueError:
            continue

        trailing_title = " ".join(tokens[token_count:]).strip()
        return candidate, trailing_title

    likely_candidates: list[str] = []
    first_token = tokens[0]
    second_token = tokens[1] if len(tokens) > 1 else None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", first_token):
        likely_candidates.append(first_token)
        if second_token and TIME_TOKEN_RE.fullmatch(second_token):
            likely_candidates.insert(0, f"{first_token} {second_token}")
    elif DAY_KEYWORD_TOKEN_RE.fullmatch(first_token) or RELATIVE_DAY_TOKEN_RE.fullmatch(first_token):
        likely_candidates.append(first_token)
        if second_token and TIME_TOKEN_RE.fullmatch(second_token):
            likely_candidates.insert(0, f"{first_token} {second_token}")
    elif TIME_TOKEN_RE.fullmatch(first_token):
        likely_candidates.append(first_token)

    for candidate in likely_candidates:
        try:
            parse_local_datetime_to_iso(
                candidate,
                allow_past=True,
                timezone_name=timezone_name,
            )
        except ValueError as exc:
            if str(exc).startswith("invalid datetime format:"):
                raise

    return None, normalized_title


def parse_capture_input(raw_text: str, *, timezone_name: str | None = None) -> dict:
    normalized_raw = str(raw_text or "").replace("\r\n", "\n").strip()
    parsed = parse_capture(normalized_raw)

    if not parsed.get("ok"):
        raise ValueError(parsed.get("error") or "invalid capture")

    action = parsed.get("action")
    item_type = parsed.get("item_type")
    modal_type = parsed.get("modal_type")

    if action == "open_modal":
        return {
            "kind": "modal",
            "raw": normalized_raw,
            "parsed": {
                "modal_type": modal_type,
                "title": parsed.get("title"),
            },
        }

    if action != "create_item":
        raise ValueError("unsupported parser action")

    if item_type == "task":
        return {
            "kind": "task",
            "raw": normalized_raw,
            "parsed": {
                "title": parsed.get("title"),
                "due_at": parsed.get("due_at"),
                "remind_ats": [parsed["remind_at"]] if parsed.get("remind_at") else [],
                "repeat_rule": parsed.get("repeat_rule"),
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
                "subtasks": list(parsed.get("subtasks") or []),
                "is_done": bool(parsed.get("is_done")),
            },
        }

    if item_type == "reminder":
        remind_at = parsed.get("remind_at")
        title = str(parsed.get("title") or "").strip()
        if not remind_at:
            remind_at, title = _extract_leading_reminder_datetime(
                title,
                timezone_name=timezone_name,
            )
            if not remind_at:
                raise ValueError("!! requires at least one reminder datetime")
        remind_ats: list[str] = []
        if remind_at:
            remind_ats = [
                parse_local_datetime_to_iso(
                    remind_at,
                    allow_past=False,
                    timezone_name=timezone_name,
                )
            ]
        return {
            "kind": "simple_reminder",
            "raw": normalized_raw,
            "parsed": {
                "title": title,
                "remind_ats": remind_ats,
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
            },
        }

    if item_type == "journal":
        return {
            "kind": "journal",
            "raw": normalized_raw,
            "parsed": {
                "title": parsed.get("title"),
                "memo": parsed.get("memo"),
                "tags": list(parsed.get("tags") or []),
            },
        }

    if item_type == "event":
        return {
            "kind": "event",
            "raw": normalized_raw,
            "parsed": {
                "title": parsed.get("title"),
                "start_date": parsed.get("start_date"),
                "end_date": parsed.get("end_date"),
                "remind_ats": [parsed["remind_at"]] if parsed.get("remind_at") else [],
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
            },
        }

    if item_type == "supply":
        return {
            "kind": "supply",
            "raw": normalized_raw,
            "parsed": {
                "title": parsed.get("title"),
            },
        }

    raise ValueError("unsupported capture kind")
