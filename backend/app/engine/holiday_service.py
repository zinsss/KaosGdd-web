from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.config import DbTables, SETTINGS
from app.db.repo.event_repo import EventRepo
from app.db.repo.items_repo import ItemsRepo
from app.integrations.holiday_ical_provider import Holiday, HolidayProvider, IcalHolidayProvider


SYSTEM_HOLIDAY_TAG = "system:kr-holiday"
READONLY_TAG = "readonly"
HOLIDAY_TAG_PREFIX = "kr-holiday:"
HOLIDAY_MEMO = "System Korean holiday synced from external iCal feed."

logger = logging.getLogger(__name__)


def holiday_key_tag(external_id: str) -> str:
    digest = hashlib.sha1(str(external_id or "").encode("utf-8")).hexdigest()[:20]
    return f"{HOLIDAY_TAG_PREFIX}{digest}"


def is_system_holiday_tags(tags: list[str]) -> bool:
    normalized = {str(tag or "").strip().lower() for tag in tags}
    return SYSTEM_HOLIDAY_TAG in normalized and READONLY_TAG in normalized


class HolidaySyncService:
    def __init__(
        self,
        items_repo: ItemsRepo,
        event_repo: EventRepo,
        *,
        provider: HolidayProvider | None = None,
        ical_url: str | None = None,
    ) -> None:
        self.items_repo = items_repo
        self.event_repo = event_repo
        self.provider = provider
        self.ical_url = SETTINGS.KOREAN_HOLIDAY_ICAL_URL if ical_url is None else str(ical_url or "").strip()

    def sync_current_and_next_year(self) -> dict:
        try:
            today = datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE)).date()
        except Exception:
            today = datetime.now(timezone.utc).date()
        return self.sync_years(start_year=today.year, end_year=today.year + 1)

    def sync_years(self, *, start_year: int, end_year: int) -> dict:
        if self.provider is None and not self.ical_url:
            return {"ok": True, "skipped": True, "reason": "missing iCal URL"}

        provider = self.provider or IcalHolidayProvider(self.ical_url)
        try:
            holidays = provider.fetch_holidays(start_year=start_year, end_year=end_year)
        except Exception as exc:
            logger.warning("Korean holiday iCal sync skipped: %s", exc)
            return {"ok": False, "skipped": True, "reason": "iCal fetch failed"}

        range_start = f"{start_year:04d}-01-01"
        range_end = f"{end_year:04d}-12-31"
        existing = self._list_existing_system_holidays(start_date=range_start, end_date=range_end)
        existing_by_key = {row["holiday_key_tag"]: row for row in existing if row.get("holiday_key_tag")}
        seen_keys: set[str] = set()
        created = 0
        updated = 0
        archived = 0

        for holiday in holidays:
            key_tag = holiday_key_tag(holiday.external_id)
            if key_tag in seen_keys:
                continue
            seen_keys.add(key_tag)
            current = existing_by_key.get(key_tag)
            if current is None:
                self._create_holiday_event(holiday, key_tag)
                created += 1
                continue
            if self._update_holiday_event(current, holiday, key_tag):
                updated += 1

        for row in existing:
            key_tag = row.get("holiday_key_tag")
            if key_tag and key_tag not in seen_keys and row.get("status") == "active":
                if self.items_repo.archive_item(row["id"]):
                    archived += 1

        return {
            "ok": True,
            "skipped": False,
            "created": created,
            "updated": updated,
            "archived": archived,
        }

    def _create_holiday_event(self, holiday: Holiday, key_tag: str) -> None:
        item_id = self.items_repo.create_item("event", holiday.title)
        self.event_repo.create_event(
            item_id,
            start_date=holiday.start_date,
            end_date=holiday.end_date,
            memo=HOLIDAY_MEMO,
        )
        self.items_repo.replace_item_tags(item_id, [SYSTEM_HOLIDAY_TAG, READONLY_TAG, key_tag])

    def _update_holiday_event(self, current: dict, holiday: Holiday, key_tag: str) -> bool:
        changed = False
        if current.get("status") != "active":
            self.items_repo.activate_item(current["id"])
            changed = True
        if current.get("title") != holiday.title:
            self.items_repo.update_item_title(current["id"], holiday.title)
            changed = True
        if (
            current.get("start_date") != holiday.start_date
            or current.get("end_date") != holiday.end_date
            or current.get("memo") != HOLIDAY_MEMO
        ):
            self.event_repo.update_event_fields(
                current["id"],
                start_date=holiday.start_date,
                end_date=holiday.end_date,
                memo=HOLIDAY_MEMO,
            )
            changed = True
        expected_tags = {SYSTEM_HOLIDAY_TAG, READONLY_TAG, key_tag}
        if set(self.items_repo.list_item_tags(current["id"])) != expected_tags:
            self.items_repo.replace_item_tags(current["id"], sorted(expected_tags))
            changed = True
        return changed

    def _list_existing_system_holidays(self, *, start_date: str, end_date: str) -> list[dict]:
        with self.event_repo.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        e.start_date,
                        e.end_date,
                        e.memo,
                        key_tags.tag AS holiday_key_tag
                    FROM {items} i
                    JOIN {event_items} e ON e.item_id = i.id
                    JOIN {item_tags} system_tags
                      ON system_tags.item_id = i.id
                     AND system_tags.tag = :system_tag
                    JOIN {item_tags} readonly_tags
                      ON readonly_tags.item_id = i.id
                     AND readonly_tags.tag = :readonly_tag
                    LEFT JOIN {item_tags} key_tags
                      ON key_tags.item_id = i.id
                     AND key_tags.tag LIKE :key_prefix
                    WHERE i.item_type = 'event'
                      AND e.start_date <= :range_end
                      AND COALESCE(e.end_date, e.start_date) >= :range_start
                    """.format(
                        items=DbTables.ITEMS,
                        event_items=DbTables.EVENT_ITEMS,
                        item_tags=DbTables.ITEM_TAGS,
                    )
                ),
                {
                    "system_tag": SYSTEM_HOLIDAY_TAG,
                    "readonly_tag": READONLY_TAG,
                    "key_prefix": f"{HOLIDAY_TAG_PREFIX}%",
                    "range_start": start_date,
                    "range_end": end_date,
                },
            ).mappings().all()
        return [dict(row) for row in rows]
