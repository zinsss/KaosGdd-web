from __future__ import annotations

from app.utils.task_raw import parse_task_raw


def parse_capture_input(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("capture is empty")

    if text.startswith("--"):
        body = text[2:].strip()
        if not body:
            raise ValueError("task body is required after --")
        parsed = parse_task_raw(body)
        return {
            "kind": "task",
            "raw": body,
            "parsed": parsed,
        }

    if text.startswith("!!"):
        body = text[2:].strip()
        if not body:
            raise ValueError("reminder body is required after !!")
        parsed = parse_task_raw(body)
        if not parsed.get("remind_ats"):
            raise ValueError("!! requires at least one r:yyyy-mm-dd HH:MM")
        return {
            "kind": "simple_reminder",
            "raw": body,
            "parsed": parsed,
        }

    if text.startswith("//"):
        body = text[2:].strip()
        if not body:
            raise ValueError("journal body is required after //")
        return {
            "kind": "journal",
            "raw": body,
            "parsed": {"title": body},
        }

    if text.startswith("^^"):
        body = text[2:].strip()
        if not body:
            raise ValueError("event body is required after ^^")
        parsed = parse_task_raw(body)
        return {
            "kind": "event",
            "raw": body,
            "parsed": parsed,
        }

    raise ValueError("capture must start with --, !!, //, or ^^")