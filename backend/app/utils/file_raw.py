from __future__ import annotations

import re

from app.utils.item_links import dedupe_links, parse_link_value

MEMO_DELIM = '"""'
TAG_RE = re.compile(r"#([^\s#]+)")
DISALLOWED_META_RE = re.compile(r"(?:^|\s)(d:|r:|R:)")


def export_file_raw(
    file_item: dict,
    *,
    tags: list[str] | None = None,
    linked_item_ids: list[str] | None = None,
) -> str:
    lines = [str(file_item.get("title") or file_item.get("original_filename") or "").strip()]

    clean_tags = [str(tag).strip().lower() for tag in (tags or []) if str(tag).strip()]
    if clean_tags:
        lines.append(" ".join(f"#{tag}" for tag in clean_tags))

    for linked_id in dedupe_links(list(linked_item_ids or [])):
        lines.append(f"l:{linked_id}")

    memo = str(file_item.get("memo") or "").strip("\n")
    if memo:
        lines.append("")
        lines.append(MEMO_DELIM)
        lines.extend(memo.splitlines())
        lines.append(MEMO_DELIM)

    return "\n".join(lines).strip()


def parse_file_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n")
    lines = text.split("\n")

    title = ""
    tags: list[str] = []
    seen_tags: set[str] = set()
    linked_item_ids: list[str] = []
    memo_lines: list[str] = []
    in_memo = False

    for original in lines:
        stripped = original.strip()

        if in_memo:
            if stripped == MEMO_DELIM:
                in_memo = False
            else:
                memo_lines.append(original)
            continue

        if not stripped:
            continue

        if stripped == MEMO_DELIM:
            in_memo = True
            continue

        if DISALLOWED_META_RE.search(stripped):
            raise ValueError("file does not support d:, r:, or R:")

        if not title:
            title = stripped
            continue

        if stripped.startswith("l:"):
            linked_item_ids.append(parse_link_value(stripped[2:]))
            continue

        if stripped.startswith("#"):
            for tag in TAG_RE.findall(stripped):
                low = tag.lower().strip()
                if low and low not in seen_tags:
                    seen_tags.add(low)
                    tags.append(low)
            continue

        raise ValueError("unsupported extra file grammar")

    if in_memo:
        raise ValueError('memo block not closed with """')

    if not title:
        raise ValueError("title is required")

    memo = "\n".join(memo_lines).rstrip("\n") if memo_lines else None

    return {
        "title": title,
        "memo": memo,
        "tags": tags,
        "linked_item_ids": dedupe_links(linked_item_ids),
    }
