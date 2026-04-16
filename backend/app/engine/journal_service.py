from app.db.repo.items_repo import ItemsRepo
from app.db.repo.journal_repo import JournalRepo
from app.utils.journal_raw import export_journal_raw, parse_journal_raw
from app.utils.timefmt import format_dt_for_ui


ITEM_TYPE_MARKERS = {
    "task": "T",
    "event": "E",
    "journal": "J",
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
    if item_type == "file":
        return f"/files/{item_id}"
    return None


class JournalService:
    def __init__(self, items_repo: ItemsRepo, journal_repo: JournalRepo) -> None:
        self.items_repo = items_repo
        self.journal_repo = journal_repo

    def create_journal(self, *, title: str, body: str, tags: list[str] | None = None) -> str:
        item_id = self.items_repo.create_item("journal", title)
        self.journal_repo.create_journal(item_id, body=body)
        self.items_repo.replace_item_tags(item_id, list(tags or []))
        return item_id

    def list_journals(self, mode: str = "active") -> list[dict]:
        rows = self.journal_repo.list_journals(mode=mode)
        return [self._decorate_journal(row) for row in rows]

    def get_journal(self, item_id: str) -> dict | None:
        detail = self.journal_repo.get_journal_detail(item_id)
        if detail is None:
            return None
        return self._decorate_journal(detail)

    def update_journal_from_raw(self, item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.journal_repo.get_journal_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_journal_raw(raw_text)
        except ValueError as exc:
            return False, str(exc)

        try:
            self.items_repo.validate_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        except ValueError as exc:
            return False, str(exc)

        self.journal_repo.update_journal_body(item_id, body=parsed["body"])
        self.items_repo.update_item_title(item_id, parsed["title"])
        self.items_repo.replace_item_tags(item_id, list(parsed.get("tags") or []))
        self.items_repo.replace_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        return True, None

    def export_journal_raw(self, item_id: str) -> str | None:
        detail = self.journal_repo.get_journal_detail(item_id)
        if detail is None:
            return None
        tags = self.items_repo.list_item_tags(item_id)
        return export_journal_raw(detail, tags=tags, linked_item_ids=self.items_repo.list_item_links(item_id))

    def remove_journal(self, item_id: str) -> bool:
        if self.journal_repo.get_journal_detail(item_id) is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def _decorate_journal(self, journal: dict) -> dict:
        item = dict(journal)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        item["tags"] = self.items_repo.list_item_tags(item["id"])
        item["has_tags"] = bool(item["tags"])

        resolved_links = self.items_repo.list_resolved_item_links(item["id"])
        item["links"] = []
        for link in resolved_links:
            target_id = str(link.get("target_item_id") or "")
            target_type = str(link.get("target_item_type") or "").lower()
            title = str(link.get("target_title") or "").strip()
            marker = ITEM_TYPE_MARKERS.get(target_type, "?")
            item["links"].append(
                {
                    "id": target_id,
                    "item_type": target_type or None,
                    "title": title or "missing item",
                    "marker": marker,
                    "is_missing": not bool(title),
                    "href": _item_type_path(target_type, target_id),
                }
            )
        return item
