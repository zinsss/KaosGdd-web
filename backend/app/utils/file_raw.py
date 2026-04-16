from app.utils.item_links import dedupe_links, parse_link_value


def export_file_raw(file_item: dict, *, linked_item_ids: list[str]) -> str:
    lines = [str(file_item.get("original_filename") or file_item.get("title") or "")]
    for linked_id in sorted(set(linked_item_ids)):
        lines.append(f"l:{linked_id}")
    return "\n".join(lines).strip()


def parse_file_raw(raw_text: str) -> dict:
    lines = [line.rstrip() for line in str(raw_text or "").splitlines()]
    title = ""
    for line in lines:
        if line.strip():
            title = line.strip()
            break
    linked_item_ids: list[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        if lowered.startswith("l:"):
            linked_item_ids.append(parse_link_value(line[2:]))
    linked_item_ids = dedupe_links(linked_item_ids)
    return {
        "title": title,
        "linked_item_ids": linked_item_ids,
    }
