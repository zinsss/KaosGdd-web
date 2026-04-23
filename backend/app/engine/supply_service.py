from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.db.repo.items_repo import ItemsRepo
from app.db.repo.supply_repo import SupplyRepo
from app.utils.timefmt import format_dt_for_ui, local_date_key_for_ui


class SupplyService:
    def __init__(self, items_repo: ItemsRepo, supply_repo: SupplyRepo) -> None:
        self.items_repo = items_repo
        self.supply_repo = supply_repo

    @staticmethod
    def normalize_title(title: str) -> str:
        return " ".join(str(title or "").strip().lower().split())

    @staticmethod
    def clean_title(title: str) -> str:
        return " ".join(str(title or "").strip().split())

    def create_supply(self, title: str) -> tuple[str | None, bool]:
        clean_title = self.clean_title(title)
        if not clean_title:
            return None, False

        normalized_title = self.normalize_title(clean_title)
        self.supply_repo.touch_preset(clean_title, normalized_title)

        existing = self.supply_repo.get_active_by_normalized_title(normalized_title)
        if existing is not None:
            return str(existing.get("id") or ""), False

        item_id = self.items_repo.create_item(item_type="supply", title=clean_title, status="active")
        try:
            self.supply_repo.create_supply(item_id=item_id, normalized_title=normalized_title)
            return item_id, True
        except IntegrityError:
            self.supply_repo.hard_delete(item_id)
            existing = self.supply_repo.get_active_by_normalized_title(normalized_title)
            if existing is not None:
                return str(existing.get("id") or ""), False
            raise

    def list_supplies(self, mode: str = "active") -> list[dict]:
        normalized_mode = str(mode or "active").strip().lower()
        if normalized_mode == "done":
            return [self._decorate_supply_row(row) for row in self.supply_repo.list_done()]
        return [self._decorate_supply_row(row) for row in self.supply_repo.list_active()]

    def mark_supply_done(self, supply_id: str) -> bool:
        return self.supply_repo.mark_done(supply_id)

    def delete_supply(self, supply_id: str) -> bool:
        return self.supply_repo.hard_delete(supply_id)

    def list_presets(self) -> list[dict]:
        return self.supply_repo.list_presets(limit=15)

    def use_preset(self, name: str) -> tuple[str | None, bool]:
        return self.create_supply(name)

    def _decorate_supply_row(self, row: dict) -> dict:
        decorated = dict(row)
        done_at = decorated.get("done_at")
        decorated["done_at_display"] = format_dt_for_ui(done_at)
        decorated["done_date_key"] = local_date_key_for_ui(done_at)
        return decorated
