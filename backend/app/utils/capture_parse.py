from __future__ import annotations

from app.parsers.capture_grammar import parse_capture


def parse_capture_input(raw_text: str) -> dict:
    parsed = parse_capture(raw_text)

    if not parsed.get("ok"):
        raise ValueError(parsed.get("error") or "invalid capture")

    action = parsed.get("action")
    item_type = parsed.get("item_type")
    modal_type = parsed.get("modal_type")

    if action == "open_modal":
        return {
            "kind": "modal",
            "raw": str(raw_text or "").replace("\r\n", "\n").strip(),
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
            "raw": str(raw_text or "").replace("\r\n", "\n").strip(),
            "parsed": {
                "title": parsed.get("title"),
                "due_at": parsed.get("due_at"),
                "remind_ats": [parsed["remind_at"]] if parsed.get("remind_at") else [],
                "repeat_rule": parsed.get("repeat_rule"),
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
                "subtasks": list(parsed.get("subtasks") or []),
            },
        }

    if item_type == "reminder":
        remind_at = parsed.get("remind_at")
        return {
            "kind": "simple_reminder",
            "raw": str(raw_text or "").replace("\r\n", "\n").strip(),
            "parsed": {
                "title": parsed.get("title"),
                "remind_ats": [remind_at] if remind_at else [],
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
            },
        }

    if item_type == "journal":
        return {
            "kind": "journal",
            "raw": str(raw_text or "").replace("\r\n", "\n").strip(),
            "parsed": {
                "title": parsed.get("title"),
                "memo": parsed.get("memo"),
                "tags": list(parsed.get("tags") or []),
            },
        }

    if item_type == "event":
        return {
            "kind": "event",
            "raw": str(raw_text or "").replace("\r\n", "\n").strip(),
            "parsed": {
                "title": parsed.get("title"),
                "due_at": parsed.get("due_at"),
                "remind_ats": [parsed["remind_at"]] if parsed.get("remind_at") else [],
                "repeat_rule": parsed.get("repeat_rule"),
                "tags": list(parsed.get("tags") or []),
                "memo": parsed.get("memo"),
            },
        }

    raise ValueError("unsupported capture kind")