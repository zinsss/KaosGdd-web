from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.parsers.capture_grammar import parse_capture

router = APIRouter(prefix="/capture", tags=["capture"])


class CaptureRequest(BaseModel):
    raw: str


@router.post("")
def capture(payload: CaptureRequest) -> dict:
    parsed = parse_capture(payload.raw)
    if not parsed.get("ok"):
        return parsed

    if parsed["action"] == "open_modal":
        return {
            "ok": True,
            "action": "open_modal",
            "modal_type": parsed.get("modal_type"),
            "title": parsed.get("title"),
        }

    if parsed["action"] == "create_item":
        return {
            "ok": True,
            "action": "create_item",
            "item_type": parsed.get("item_type"),
            "title": parsed.get("title"),
            "due_at": parsed.get("due_at"),
            "remind_at": parsed.get("remind_at"),
            "repeat_rule": parsed.get("repeat_rule"),
            "tags": parsed.get("tags", []),
            "memo": parsed.get("memo"),
            "subtasks": parsed.get("subtasks", []),
        }

    return {"ok": False, "error": "unsupported parser action"}