from __future__ import annotations


def parse_note_raw(raw_text: str) -> dict:
    body = str(raw_text or "").replace("\r\n", "\n").strip("\n")
    if not body.strip():
        raise ValueError("note content is required")
    return {"body": body}


def export_note_raw(note: dict) -> str:
    return str(note.get("body") or "").strip("\n")


def derive_note_title(markdown_body: str) -> str:
    text = str(markdown_body or "")
    for line in text.splitlines():
        clean = line.strip()
        if not clean:
            continue
        clean = clean.lstrip("#").strip()
        if clean:
            return clean[:120]
    return "Untitled note"
