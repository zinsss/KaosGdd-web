from __future__ import annotations

from app.utils.item_links import dedupe_links

META_OPEN = ":::"
META_CLOSE = ":::"
META_KEYS = ("title", "tags", "link")


def blank_note_template() -> str:
    return "\n".join([META_OPEN, "title:", "tags:", "link:", META_CLOSE])


def _split_csv_values(raw: str) -> list[str]:
    values: list[str] = []
    for part in str(raw or "").split(","):
        clean = part.strip()
        if clean:
            values.append(clean)
    return values


def parse_note_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n")
    lines = text.split("\n")

    if not lines or lines[0].strip() != META_OPEN:
        raise ValueError("note metadata must start with :::")

    end_idx = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == META_CLOSE:
            end_idx = idx
            break
    if end_idx is None:
        raise ValueError("note metadata block must be closed with :::")

    meta_values = {"title": "", "tags": "", "link": ""}

    for raw_line in lines[1:end_idx]:
        stripped = raw_line.strip()
        if not stripped:
            continue
        if ":" not in stripped:
            raise ValueError(f"invalid note metadata line: {raw_line}")
        key, value = stripped.split(":", 1)
        key = key.strip().lower()
        if key not in META_KEYS:
            raise ValueError(f"unsupported note metadata key: {key}")
        meta_values[key] = value.strip()

    title = meta_values["title"].strip()
    if not title:
        raise ValueError("title: is required")

    tags = []
    seen_tags: set[str] = set()
    for tag in _split_csv_values(meta_values["tags"]):
        lowered = tag.lower()
        if lowered in seen_tags:
            continue
        seen_tags.add(lowered)
        tags.append(lowered)

    links = dedupe_links(_split_csv_values(meta_values["link"]))

    body_lines = lines[end_idx + 1 :]
    if body_lines and body_lines[0].strip() == "":
        body_lines = body_lines[1:]
    body = "\n".join(body_lines).rstrip("\n")

    return {
        "title": title,
        "tags": tags,
        "linked_item_ids": links,
        "body": body,
    }


def export_note_raw(note: dict, *, tags: list[str] | None = None, linked_item_ids: list[str] | None = None) -> str:
    title = str(note.get("title") or "").strip()
    tag_text = ", ".join(str(tag).strip().lower() for tag in (tags or []) if str(tag).strip())
    link_text = ", ".join(dedupe_links([str(v).strip() for v in (linked_item_ids or [])]))
    body = str(note.get("body") or "").strip("\n")

    lines = [
        META_OPEN,
        f"title: {title}" if title else "title:",
        f"tags: {tag_text}" if tag_text else "tags:",
        f"link: {link_text}" if link_text else "link:",
        META_CLOSE,
    ]
    if body:
        lines.extend(["", body])
    return "\n".join(lines)


def extract_note_snippet(markdown_body: str, max_len: int = 110) -> str:
    for raw_line in str(markdown_body or "").splitlines():
        line = raw_line.strip().lstrip("#").strip()
        if not line:
            continue
        if len(line) <= max_len:
            return line
        return line[: max_len - 1].rstrip() + "…"
    return ""
