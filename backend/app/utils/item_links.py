from __future__ import annotations

import re

LINK_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def parse_link_value(raw_value: str) -> str:
    value = str(raw_value or "").strip()
    if not value:
        raise ValueError("empty l: is invalid")
    if not LINK_ID_RE.fullmatch(value):
        raise ValueError("malformed l:")
    return value


def dedupe_links(link_ids: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for link_id in link_ids:
        clean = str(link_id or "").strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        deduped.append(clean)
    return deduped
