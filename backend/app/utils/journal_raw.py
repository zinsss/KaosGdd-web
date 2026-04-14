from __future__ import annotations

import re

JOURNAL_PREFIX = "// "
TAG_RE = re.compile(r"#([^\s#]+)")
META_RE = re.compile(r"(?:^|\s)(r:|d:|R:)")


def _extract_title(body: str) -> str:
    for line in body.splitlines():
        text = line.strip()
        if text:
            return text[:120]
    return ""


def parse_journal_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("journal content is required")

    lines = text.split("\n")
    first_idx = next((idx for idx, line in enumerate(lines) if line.strip()), None)
    if first_idx is None:
        raise ValueError("journal content is required")

    first = lines[first_idx].strip()
    if not first.startswith(JOURNAL_PREFIX):
        raise ValueError("journal line must start with // ")

    first_content = first[len(JOURNAL_PREFIX):].strip()
    body_lines: list[str] = []
    if first_content:
        body_lines.append(first_content)

    tags: list[str] = []
    seen: set[str] = set()

    for line in lines[first_idx + 1:]:
        stripped = line.strip()
        if not stripped:
            continue

        if META_RE.search(stripped):
            raise ValueError("journal does not support r:, d:, or R:")

        for tag in TAG_RE.findall(stripped):
            low = tag.lower()
            if low and low not in seen:
                seen.add(low)
                tags.append(low)

        if stripped.startswith("#") and stripped.replace("#", "").strip():
            continue

        body_lines.append(line.rstrip())

    if META_RE.search(first_content):
        raise ValueError("journal does not support r:, d:, or R:")

    for tag in TAG_RE.findall(first_content):
        low = tag.lower()
        if low and low not in seen:
            seen.add(low)
            tags.append(low)

    body = "\n".join([line for line in body_lines if str(line).strip()]).strip()
    if not body:
        raise ValueError("journal content is required")

    return {"title": _extract_title(body), "body": body, "tags": tags}


def export_journal_raw(journal: dict, *, tags: list[str] | None = None) -> str:
    body = str(journal.get("body") or "").strip("\n")
    if not body:
        body = str(journal.get("title") or "").strip()

    lines = body.splitlines() if body else []
    first = lines[0].strip() if lines else ""
    rest = lines[1:] if len(lines) > 1 else []

    out = [f"{JOURNAL_PREFIX}{first}".rstrip()]
    out.extend(rest)

    clean_tags = [str(tag).strip().lower() for tag in (tags or []) if str(tag).strip()]
    if clean_tags:
        out.append(" ".join(f"#{tag}" for tag in clean_tags))

    return "\n".join(out).strip()
