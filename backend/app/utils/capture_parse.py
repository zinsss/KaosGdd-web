from __future__ import annotations

from app.parsers.capture_grammar import parse_capture
from app.utils.datetime_parse import parse_local_datetime_to_iso


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
                "title": parsed.get("title"),
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

    raise ValueError("unsupported capture kind")
