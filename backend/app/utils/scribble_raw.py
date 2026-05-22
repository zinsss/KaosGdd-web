from __future__ import annotations

import re

SCRIBBLE_PREFIX = "..."
TAG_RE = re.compile(r"#([^\s#]+)")
UNSUPPORTED_META_RE = re.compile(r"^(dr:|d:|r:|R:)\s*", flags=re.IGNORECASE)


def _dedupe_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        clean = str(tag or "").strip().lower()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def _strip_tags(line: str) -> tuple[str, list[str]]:
    tags = TAG_RE.findall(line)
    without_tags = TAG_RE.sub("", line)
    return without_tags.rstrip(), tags


def parse_scribble_raw(raw_text: str, *, require_prefix: bool = True) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("scribble content is required")

    lines = [line.rstrip() for line in text.splitlines()]
    first_idx = next((idx for idx, line in enumerate(lines) if line.strip()), None)
    if first_idx is None:
        raise ValueError("scribble content is required")

    first = lines[first_idx].strip()
    content_lines: list[str]
    if require_prefix:
        if first == SCRIBBLE_PREFIX:
            content_lines = lines[first_idx + 1 :]
        elif first.startswith(f"{SCRIBBLE_PREFIX} "):
            content_lines = [first[len(SCRIBBLE_PREFIX) :].strip(), *lines[first_idx + 1 :]]
        else:
            raise ValueError("scribble must start with ...")
    else:
        if first == SCRIBBLE_PREFIX:
            content_lines = lines[first_idx + 1 :]
        elif first.startswith(f"{SCRIBBLE_PREFIX} "):
            content_lines = [first[len(SCRIBBLE_PREFIX) :].strip(), *lines[first_idx + 1 :]]
        else:
            content_lines = lines[first_idx:]

    body_lines: list[str] = []
    tags: list[str] = []

    for original in content_lines:
        line = original.strip()
        if not line:
            if body_lines:
                body_lines.append("")
            continue
        if UNSUPPORTED_META_RE.match(line):
            raise ValueError("scribble does not support d:, r:, or R:")
        if line.startswith("---") or line.startswith("--x "):
            raise ValueError("scribble does not support subtasks")
        body_line, line_tags = _strip_tags(original)
        tags.extend(line_tags)
        if body_line.strip():
            body_lines.append(body_line)

    body = "\n".join(body_lines).strip()
    if not body:
        raise ValueError("scribble content is required")

    return {"body": body, "tags": _dedupe_tags(tags)}


def export_scribble_raw(body: str, tags: list[str] | None = None) -> str:
    clean_body = str(body or "").replace("\r\n", "\n").strip()
    tag_text = " ".join(f"#{tag}" for tag in _dedupe_tags(tags or []))
    if "\n" not in clean_body:
        return f"{SCRIBBLE_PREFIX} {clean_body}{(' ' + tag_text) if tag_text else ''}".strip()
    if tag_text:
        return f"{SCRIBBLE_PREFIX}\n{clean_body}\n{tag_text}"
    return f"{SCRIBBLE_PREFIX}\n{clean_body}"
