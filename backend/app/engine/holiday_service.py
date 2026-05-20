from __future__ import annotations

import hashlib
import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.config import DbTables, SETTINGS
from app.db.repo.event_repo import EventRepo
from app.db.repo.items_repo import ItemsRepo
from app.integrations.holiday_ical_provider import Holiday, HolidayProvider, IcalHolidayProvider


SYSTEM_KR_CALENDAR_TAG = "system:kr-calendar"
LEGACY_SYSTEM_HOLIDAY_TAG = "system:kr-holiday"
SYSTEM_CUSTOM_CALENDAR_TAG = "system:custom-calendar"
READONLY_TAG = "readonly"
HOLIDAY_TAG_PREFIX = "kr-holiday:"
CUSTOM_TAG_PREFIX = "custom-calendar:"
EVENT_CLASS_PREFIX = "event-class:"
CLASSIFICATION_SOURCE_PREFIX = "classification-source:"
EVENT_CLASS_PUBLIC_HOLIDAY = "public-holiday"
EVENT_CLASS_OBSERVANCE = "observance"
EVENT_CLASS_MARKET_SATURDAY = "market-saturday"
EVENT_CLASS_CLAIM_DAY = "claim-day"
CLASSIFICATION_SOURCE_AUTO = "auto"
CLASSIFICATION_SOURCE_MANUAL = "manual"
HOLIDAY_MEMO = "System Korean calendar event synced from external iCal feed."
MARKET_SATURDAY_TITLE = "Market Saturday"
CLAIM_DAY_TITLE = "Claim Day"
MARKET_SATURDAY_DAYS = {5, 10, 15, 20, 25, 30}

logger = logging.getLogger(__name__)


def holiday_key_tag(external_id: str) -> str:
    digest = hashlib.sha1(str(external_id or "").encode("utf-8")).hexdigest()[:20]
    return f"{HOLIDAY_TAG_PREFIX}{digest}"


def custom_key_tag(kind: str, event_date: str) -> str:
    return f"{CUSTOM_TAG_PREFIX}{kind}:{event_date}"


def event_class_tag(event_class: str) -> str:
    return f"{EVENT_CLASS_PREFIX}{event_class}"


def classification_source_tag(source: str) -> str:
    return f"{CLASSIFICATION_SOURCE_PREFIX}{source}"


def normalized_tags(tags: list[str]) -> set[str]:
    return {str(tag or "").strip().lower() for tag in tags}


def tag_value(tags: list[str], prefix: str) -> str | None:
    for tag in normalized_tags(tags):
        if tag.startswith(prefix):
            return tag.removeprefix(prefix)
    return None


def is_imported_calendar_tags(tags: list[str]) -> bool:
    values = normalized_tags(tags)
    return READONLY_TAG in values and (SYSTEM_KR_CALENDAR_TAG in values or LEGACY_SYSTEM_HOLIDAY_TAG in values)


def is_custom_calendar_tags(tags: list[str]) -> bool:
    values = normalized_tags(tags)
    return READONLY_TAG in values and SYSTEM_CUSTOM_CALENDAR_TAG in values


def is_readonly_system_event_tags(tags: list[str]) -> bool:
    return is_imported_calendar_tags(tags) or is_custom_calendar_tags(tags)


def event_class_from_tags(tags: list[str]) -> str | None:
    return tag_value(tags, EVENT_CLASS_PREFIX)


def classification_source_from_tags(tags: list[str]) -> str | None:
    return tag_value(tags, CLASSIFICATION_SOURCE_PREFIX)


def _parse_ymd(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _date_range(start: date, end: date):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


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
        start_year, end_year = self.current_and_next_years()
        return self.sync_years(start_year=start_year, end_year=end_year)

    def current_and_next_years(self) -> tuple[int, int]:
        try:
            today = datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE)).date()
        except Exception:
            today = datetime.now(timezone.utc).date()
        return today.year, today.year + 1

    def sync_years(self, *, start_year: int, end_year: int) -> dict:
        imported_result = self._sync_imported_events(start_year=start_year, end_year=end_year)
        custom_result = self.recalculate_custom_events(start_year=start_year, end_year=end_year)
        return {**imported_result, "custom": custom_result}

    def _sync_imported_events(self, *, start_year: int, end_year: int) -> dict:
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
        existing = self._list_existing_imported_events(start_date=range_start, end_date=range_end)
        existing_by_key = {row["calendar_key_tag"]: row for row in existing if row.get("calendar_key_tag")}
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
                self._create_imported_event(holiday, key_tag)
                created += 1
                continue
            if self._update_imported_event(current, holiday, key_tag):
                updated += 1

        for row in existing:
            key_tag = row.get("calendar_key_tag")
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

    def set_imported_event_public_holiday(self, item_id: str, *, is_public_holiday: bool) -> dict | None:
        detail = self.event_repo.get_event_detail(item_id)
        if detail is None:
            return None
        tags = self.items_repo.list_item_tags(item_id)
        if not is_imported_calendar_tags(tags):
            return None
        key_tags = [tag for tag in tags if tag.startswith(HOLIDAY_TAG_PREFIX)]
        next_class = EVENT_CLASS_PUBLIC_HOLIDAY if is_public_holiday else EVENT_CLASS_OBSERVANCE
        self.items_repo.replace_item_tags(
            item_id,
            [
                SYSTEM_KR_CALENDAR_TAG,
                READONLY_TAG,
                *key_tags,
                event_class_tag(next_class),
                classification_source_tag(CLASSIFICATION_SOURCE_MANUAL),
            ],
        )
        start_year, end_year = self.current_and_next_years()
        self.recalculate_custom_events(start_year=start_year, end_year=end_year)
        return self.event_repo.get_event_detail(item_id)

    def recalculate_custom_events(self, *, start_year: int, end_year: int) -> dict:
        range_start = _parse_ymd(f"{start_year:04d}-01-01")
        range_end = _parse_ymd(f"{end_year:04d}-12-31")
        market_dates = self._market_saturday_dates(range_start, range_end)
        public_dates = self._public_holiday_dates(start_date=range_start.isoformat(), end_date=range_end.isoformat())
        claim_dates = self._claim_day_dates(range_start, range_end, market_dates, public_dates)

        market_result = self._sync_generated_events(
            title=MARKET_SATURDAY_TITLE,
            event_class=EVENT_CLASS_MARKET_SATURDAY,
            event_dates=market_dates,
            start_date=range_start.isoformat(),
            end_date=range_end.isoformat(),
        )
        claim_result = self._sync_generated_events(
            title=CLAIM_DAY_TITLE,
            event_class=EVENT_CLASS_CLAIM_DAY,
            event_dates=claim_dates,
            start_date=range_start.isoformat(),
            end_date=range_end.isoformat(),
        )
        return {"market_saturday": market_result, "claim_day": claim_result}

    def _create_imported_event(self, holiday: Holiday, key_tag: str) -> None:
        item_id = self.items_repo.create_item("event", holiday.title)
        self.event_repo.create_event(
            item_id,
            start_date=holiday.start_date,
            end_date=holiday.end_date,
            memo=HOLIDAY_MEMO,
        )
        self.items_repo.replace_item_tags(
            item_id,
            [
                SYSTEM_KR_CALENDAR_TAG,
                READONLY_TAG,
                key_tag,
                event_class_tag(EVENT_CLASS_OBSERVANCE),
                classification_source_tag(CLASSIFICATION_SOURCE_AUTO),
            ],
        )

    def _update_imported_event(self, current: dict, holiday: Holiday, key_tag: str) -> bool:
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

        current_tags = self.items_repo.list_item_tags(current["id"])
        source = classification_source_from_tags(current_tags)
        event_class = event_class_from_tags(current_tags)
        if source == CLASSIFICATION_SOURCE_MANUAL:
            next_class = event_class if event_class in {EVENT_CLASS_PUBLIC_HOLIDAY, EVENT_CLASS_OBSERVANCE} else EVENT_CLASS_OBSERVANCE
            next_source = CLASSIFICATION_SOURCE_MANUAL
        else:
            next_class = EVENT_CLASS_OBSERVANCE
            next_source = CLASSIFICATION_SOURCE_AUTO
        expected_tags = {
            SYSTEM_KR_CALENDAR_TAG,
            READONLY_TAG,
            key_tag,
            event_class_tag(next_class),
            classification_source_tag(next_source),
        }
        if set(current_tags) != expected_tags:
            self.items_repo.replace_item_tags(current["id"], sorted(expected_tags))
            changed = True
        return changed

    def _sync_generated_events(
        self,
        *,
        title: str,
        event_class: str,
        event_dates: set[date],
        start_date: str,
        end_date: str,
    ) -> dict:
        existing = self._list_existing_custom_events(start_date=start_date, end_date=end_date, event_class=event_class)
        existing_by_key = {row["calendar_key_tag"]: row for row in existing if row.get("calendar_key_tag")}
        expected_keys = {custom_key_tag(event_class, event_date.isoformat()) for event_date in event_dates}
        created = 0
        updated = 0
        archived = 0

        for event_date in sorted(event_dates):
            key_tag = custom_key_tag(event_class, event_date.isoformat())
            current = existing_by_key.get(key_tag)
            if current is None:
                self._create_generated_event(title=title, event_class=event_class, event_date=event_date, key_tag=key_tag)
                created += 1
                continue
            if self._update_generated_event(current, title=title, event_class=event_class, event_date=event_date, key_tag=key_tag):
                updated += 1

        for row in existing:
            key_tag = row.get("calendar_key_tag")
            if key_tag and key_tag not in expected_keys and row.get("status") == "active":
                if self.items_repo.archive_item(row["id"]):
                    archived += 1

        return {"created": created, "updated": updated, "archived": archived}

    def _create_generated_event(self, *, title: str, event_class: str, event_date: date, key_tag: str) -> None:
        item_id = self.items_repo.create_item("event", title)
        self.event_repo.create_event(item_id, start_date=event_date.isoformat(), end_date=None, memo=None)
        self.items_repo.replace_item_tags(
            item_id,
            [SYSTEM_CUSTOM_CALENDAR_TAG, READONLY_TAG, key_tag, event_class_tag(event_class)],
        )

    def _update_generated_event(self, current: dict, *, title: str, event_class: str, event_date: date, key_tag: str) -> bool:
        changed = False
        if current.get("status") != "active":
            self.items_repo.activate_item(current["id"])
            changed = True
        if current.get("title") != title:
            self.items_repo.update_item_title(current["id"], title)
            changed = True
        if current.get("start_date") != event_date.isoformat() or current.get("end_date") is not None:
            self.event_repo.update_event_fields(current["id"], start_date=event_date.isoformat(), end_date=None, memo=None)
            changed = True
        expected_tags = {SYSTEM_CUSTOM_CALENDAR_TAG, READONLY_TAG, key_tag, event_class_tag(event_class)}
        if set(self.items_repo.list_item_tags(current["id"])) != expected_tags:
            self.items_repo.replace_item_tags(current["id"], sorted(expected_tags))
            changed = True
        return changed

    def _market_saturday_dates(self, start_date: date, end_date: date) -> set[date]:
        return {
            event_date
            for event_date in _date_range(start_date, end_date)
            if event_date.day in MARKET_SATURDAY_DAYS and event_date.weekday() == 5
        }

    def _claim_day_dates(self, start_date: date, end_date: date, market_dates: set[date], public_dates: set[date]) -> set[date]:
        claim_dates: set[date] = set()
        for event_date in _date_range(start_date, end_date):
            if event_date.weekday() != 4:
                continue
            claim_date = event_date + timedelta(days=1) if event_date + timedelta(days=1) in market_dates else event_date
            while claim_date in public_dates:
                claim_date -= timedelta(days=1)
            if start_date <= claim_date <= end_date:
                claim_dates.add(claim_date)
        return claim_dates

    def _public_holiday_dates(self, *, start_date: str, end_date: str) -> set[date]:
        public_dates: set[date] = set()
        for row in self._list_imported_events_by_class(
            start_date=start_date,
            end_date=end_date,
            event_class=EVENT_CLASS_PUBLIC_HOLIDAY,
        ):
            first = _parse_ymd(row["start_date"])
            last = _parse_ymd(row.get("end_date") or row["start_date"])
            for event_date in _date_range(first, last):
                public_dates.add(event_date)
        return public_dates

    def _list_existing_imported_events(self, *, start_date: str, end_date: str) -> list[dict]:
        return self._list_system_events(
            start_date=start_date,
            end_date=end_date,
            system_tags=[SYSTEM_KR_CALENDAR_TAG, LEGACY_SYSTEM_HOLIDAY_TAG],
            key_prefix=f"{HOLIDAY_TAG_PREFIX}%",
        )

    def _list_imported_events_by_class(self, *, start_date: str, end_date: str, event_class: str) -> list[dict]:
        system_tags = [SYSTEM_KR_CALENDAR_TAG, LEGACY_SYSTEM_HOLIDAY_TAG]
        placeholders = ", ".join(f":system_tag_{index}" for index, _ in enumerate(system_tags))
        params = {f"system_tag_{index}": tag for index, tag in enumerate(system_tags)}
        with self.event_repo.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.title, i.status, e.start_date, e.end_date, e.memo
                    FROM {items} i
                    JOIN {event_items} e ON e.item_id = i.id
                    JOIN {item_tags} system_tags
                      ON system_tags.item_id = i.id
                     AND system_tags.tag IN ({placeholders})
                    JOIN {item_tags} readonly_tags
                      ON readonly_tags.item_id = i.id
                     AND readonly_tags.tag = :readonly_tag
                    JOIN {item_tags} class_tags
                      ON class_tags.item_id = i.id
                     AND class_tags.tag = :class_tag
                    WHERE i.item_type = 'event'
                      AND i.status = 'active'
                      AND e.start_date <= :range_end
                      AND COALESCE(e.end_date, e.start_date) >= :range_start
                    """.format(
                        items=DbTables.ITEMS,
                        event_items=DbTables.EVENT_ITEMS,
                        item_tags=DbTables.ITEM_TAGS,
                        placeholders=placeholders,
                    )
                ),
                {
                    **params,
                    "readonly_tag": READONLY_TAG,
                    "class_tag": event_class_tag(event_class),
                    "range_start": start_date,
                    "range_end": end_date,
                },
            ).mappings().all()
        return [dict(row) for row in rows]

    def _list_existing_custom_events(self, *, start_date: str, end_date: str, event_class: str) -> list[dict]:
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
                        key_tags.tag AS calendar_key_tag
                    FROM {items} i
                    JOIN {event_items} e ON e.item_id = i.id
                    JOIN {item_tags} system_tags
                      ON system_tags.item_id = i.id
                     AND system_tags.tag = :system_tag
                    JOIN {item_tags} readonly_tags
                      ON readonly_tags.item_id = i.id
                     AND readonly_tags.tag = :readonly_tag
                    JOIN {item_tags} class_tags
                      ON class_tags.item_id = i.id
                     AND class_tags.tag = :class_tag
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
                    "system_tag": SYSTEM_CUSTOM_CALENDAR_TAG,
                    "readonly_tag": READONLY_TAG,
                    "class_tag": event_class_tag(event_class),
                    "key_prefix": f"{CUSTOM_TAG_PREFIX}{event_class}:%",
                    "range_start": start_date,
                    "range_end": end_date,
                },
            ).mappings().all()
        return [dict(row) for row in rows]

    def _list_system_events(
        self,
        *,
        start_date: str,
        end_date: str,
        system_tags: list[str],
        key_prefix: str,
    ) -> list[dict]:
        placeholders = ", ".join(f":system_tag_{index}" for index, _ in enumerate(system_tags))
        params = {f"system_tag_{index}": tag for index, tag in enumerate(system_tags)}
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
                        key_tags.tag AS calendar_key_tag
                    FROM {items} i
                    JOIN {event_items} e ON e.item_id = i.id
                    JOIN {item_tags} system_tags
                      ON system_tags.item_id = i.id
                     AND system_tags.tag IN ({placeholders})
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
                        placeholders=placeholders,
                    )
                ),
                {
                    **params,
                    "readonly_tag": READONLY_TAG,
                    "key_prefix": key_prefix,
                    "range_start": start_date,
                    "range_end": end_date,
                },
            ).mappings().all()
        return [dict(row) for row in rows]
