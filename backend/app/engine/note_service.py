from app.db.repo.items_repo import ItemsRepo
from app.db.repo.note_repo import NoteRepo
from app.utils.note_raw import export_note_raw, extract_note_snippet, parse_note_raw
from app.utils.timefmt import format_dt_for_ui

ITEM_TYPE_MARKERS = {
    "task": "T",
    "event": "E",
    "journal": "J",
    "note": "N",
    "file": "F",
    "fax": "X",
    "mail": "M",
}


def _item_type_path(item_type: str, item_id: str) -> str | None:
    if item_type == "task":
        return f"/tasks/{item_id}"
    if item_type == "event":
        return f"/events/{item_id}"
    if item_type == "journal":
        return "/journals"
    if item_type == "note":
        return f"/notes/{item_id}"
    if item_type == "file":
        return f"/files/{item_id}"
    return None


class NoteService:
    def __init__(self, items_repo: ItemsRepo, note_repo: NoteRepo) -> None:
        self.items_repo = items_repo
        self.note_repo = note_repo

    def create_note_from_raw(self, raw_text: str) -> tuple[str | None, str | None]:
        try:
            parsed = parse_note_raw(raw_text)
        except ValueError as exc:
            return None, str(exc)

        item_id = self.items_repo.create_item("note", parsed["title"])
        try:
            self.items_repo.validate_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        except ValueError as exc:
            self.items_repo.soft_delete_item(item_id)
            return None, str(exc)

        self.note_repo.create_note(item_id, body=parsed["body"])
        self.items_repo.replace_item_tags(item_id, list(parsed.get("tags") or []))
        self.items_repo.replace_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        return item_id, None

    def list_notes(self, mode: str = "active") -> list[dict]:
        rows = self.note_repo.list_notes(mode=mode)
        return [self._decorate_note(row) for row in rows]

    def get_note(self, item_id: str) -> dict | None:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return None
        return self._decorate_note(detail)

    def update_note_from_raw(self, item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_note_raw(raw_text)
            self.items_repo.validate_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        except ValueError as exc:
            return False, str(exc)

        self.note_repo.update_note_body(item_id, body=parsed["body"])
        self.items_repo.update_item_title(item_id, parsed["title"])
        self.items_repo.replace_item_tags(item_id, list(parsed.get("tags") or []))
        self.items_repo.replace_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        return True, None

    def export_note_raw(self, item_id: str) -> str | None:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return None
        return export_note_raw(
            detail,
            tags=self.items_repo.list_item_tags(item_id),
            linked_item_ids=self.items_repo.list_item_links(item_id),
        )

    def remove_note(self, item_id: str) -> bool:
        if self.note_repo.get_note_detail(item_id) is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def _decorate_note(self, note: dict) -> dict:
        item = dict(note)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        item["tags"] = self.items_repo.list_item_tags(item["id"])
        item["snippet"] = extract_note_snippet(item.get("body") or "")

        resolved_links = self.items_repo.list_resolved_item_links(item["id"])
        item["links"] = []
        for link in resolved_links:
            target_id = str(link.get("target_item_id") or "")
            target_type = str(link.get("target_item_type") or "").lower()
            title = str(link.get("target_title") or "").strip()
            item["links"].append(
                {
                    "id": target_id,
                    "item_type": target_type or None,
                    "title": title or "missing item",
                    "marker": ITEM_TYPE_MARKERS.get(target_type, "?"),
                    "is_missing": not bool(title),
                    "href": _item_type_path(target_type, target_id),
                }
            )

        return item
