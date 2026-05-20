from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest

from app.config import DEFAULT_KOREAN_HOLIDAY_ICAL_URL
from app.engine.holiday_service import HolidaySyncService
from app.integrations.holiday_ical_provider import Holiday, IcalHolidayProvider


class FakeHolidayProvider:
    def __init__(self, holidays: list[Holiday] | None = None, *, error: Exception | None = None) -> None:
        self.holidays = holidays or []
        self.error = error

    def fetch_holidays(self, *, start_year: int, end_year: int) -> list[Holiday]:
        if self.error is not None:
            raise self.error
        return self.holidays


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "korean-holiday-sync-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    yield main_module
    main_module.stop_holiday_sync_scheduler()


def sync_service(main_module, holidays: list[Holiday] | None = None, *, error: Exception | None = None):
    return HolidaySyncService(
        main_module.items_repo,
        main_module.event_repo,
        provider=FakeHolidayProvider(holidays, error=error),
    )


def list_events(main_module, mode: str = "active") -> list[dict]:
    return main_module.event_service.list_events_in_range(
        start_date="2026-01-01",
        end_date="2026-12-31",
        mode=mode,
    )


def events_by_class(main_module, event_class: str, mode: str = "active") -> list[dict]:
    return [event for event in list_events(main_module, mode=mode) if event.get("event_class") == event_class]


def imported_events(main_module, mode: str = "active") -> list[dict]:
    return [event for event in list_events(main_module, mode=mode) if event.get("is_imported_calendar_event")]


def event_dates(events: list[dict]) -> set[str]:
    return {event["start_date"] for event in events}


def test_imported_events_default_to_observance(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-new-year", uid="uid-new-year", title="신정", start_date="2026-01-01")],
    )

    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["ok"] is True
    imported = imported_events(main_module)
    assert len(imported) == 1
    assert imported[0]["title"] == "신정"
    assert imported[0]["event_class"] == "observance"
    assert imported[0]["classification_source"] == "auto"
    assert {"system:kr-calendar", "readonly", "event-class:observance", "classification-source:auto"}.issubset(
        set(imported[0]["tags"])
    )
    assert imported[0]["reminders"] == []


def test_checkbox_sets_public_holiday(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-public", uid="uid-public", title="Public", start_date="2026-01-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    event_id = imported_events(main_module)[0]["id"]

    response = main_module.update_event_classification(event_id, {"is_public_holiday": True})

    assert response["ok"] is True
    assert response["item"]["event_class"] == "public-holiday"
    assert response["item"]["classification_source"] == "manual"


def test_checkbox_sets_observance(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-observance", uid="uid-observance", title="Maybe", start_date="2026-01-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    event_id = imported_events(main_module)[0]["id"]
    main_module.update_event_classification(event_id, {"is_public_holiday": True})

    response = main_module.update_event_classification(event_id, {"is_public_holiday": False})

    assert response["ok"] is True
    assert response["item"]["event_class"] == "observance"
    assert response["item"]["classification_source"] == "manual"


def test_manual_classification_survives_monthly_sync(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-alt", uid="uid-alt", title="Old", start_date="2026-05-05")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    event_id = imported_events(main_module)[0]["id"]
    main_module.update_event_classification(event_id, {"is_public_holiday": True})

    service.provider = FakeHolidayProvider(
        [Holiday(external_id="uid-alt", uid="uid-alt", title="New", start_date="2026-05-06")]
    )
    service.sync_years(start_year=2026, end_year=2026)

    item = main_module.get_event(event_id)["item"]
    assert item["title"] == "New"
    assert item["start_date"] == "2026-05-06"
    assert item["event_class"] == "public-holiday"
    assert item["classification_source"] == "manual"


def test_market_saturday_generation(main_module) -> None:
    service = sync_service(main_module, [])

    service.sync_years(start_year=2026, end_year=2026)

    assert "2026-01-10" in event_dates(events_by_class(main_module, "market-saturday"))
    market = [event for event in events_by_class(main_module, "market-saturday") if event["start_date"] == "2026-01-10"][0]
    assert market["title"] == "Market Saturday"
    assert {"system:custom-calendar", "readonly", "event-class:market-saturday"}.issubset(set(market["tags"]))


def test_claim_day_friday_default(main_module) -> None:
    service = sync_service(main_module, [])

    service.sync_years(start_year=2026, end_year=2026)

    assert "2026-01-02" in event_dates(events_by_class(main_module, "claim-day"))


def test_claim_day_market_saturday_override(main_module) -> None:
    service = sync_service(main_module, [])

    service.sync_years(start_year=2026, end_year=2026)

    claim_dates = event_dates(events_by_class(main_module, "claim-day"))
    assert "2026-01-10" in claim_dates
    assert "2026-01-09" not in claim_dates


def test_claim_day_backward_shift_on_public_holiday(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-claim-block", uid="uid-claim-block", title="Block", start_date="2026-01-02")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    main_module.update_event_classification(imported_events(main_module)[0]["id"], {"is_public_holiday": True})

    claim_dates = event_dates(events_by_class(main_module, "claim-day"))
    assert "2026-01-01" in claim_dates
    assert "2026-01-02" not in claim_dates


def test_observance_does_not_shift_claim_day(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-observe-friday", uid="uid-observe-friday", title="Observe", start_date="2026-01-02")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    claim_dates = event_dates(events_by_class(main_module, "claim-day"))
    assert "2026-01-02" in claim_dates
    assert "2026-01-01" not in claim_dates


def test_recalculation_occurs_immediately_after_classification_change(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-market-block", uid="uid-market-block", title="Block", start_date="2026-01-10")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    assert "2026-01-10" in event_dates(events_by_class(main_module, "claim-day"))

    main_module.update_event_classification(imported_events(main_module)[0]["id"], {"is_public_holiday": True})

    claim_dates = event_dates(events_by_class(main_module, "claim-day"))
    assert "2026-01-09" in claim_dates
    assert "2026-01-10" not in claim_dates


def test_generated_events_are_idempotent(main_module) -> None:
    service = sync_service(main_module, [])

    service.sync_years(start_year=2026, end_year=2026)
    first_market_count = len(events_by_class(main_module, "market-saturday"))
    first_claim_count = len(events_by_class(main_module, "claim-day"))
    service.sync_years(start_year=2026, end_year=2026)

    assert len(events_by_class(main_module, "market-saturday")) == first_market_count
    assert len(events_by_class(main_module, "claim-day")) == first_claim_count


def test_generated_and_synced_events_are_readonly(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-readonly", uid="uid-readonly", title="Readonly", start_date="2026-03-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    readonly_ids = [
        imported_events(main_module)[0]["id"],
        events_by_class(main_module, "market-saturday")[0]["id"],
        events_by_class(main_module, "claim-day")[0]["id"],
    ]

    for event_id in readonly_ids:
        assert main_module.update_event(event_id, {"title": "Changed"}) == {"ok": False, "error": "event is read-only"}
        assert main_module.update_event_raw(event_id, {"raw": "^^ 2026-03-02\nChanged"}) == {
            "ok": False,
            "error": "event is read-only",
        }
        assert main_module.remove_event(event_id) == {"ok": False, "error": "event is read-only"}


def test_user_created_events_are_untouched(main_module) -> None:
    user_id = main_module.event_service.create_event(title="User holiday plan", start_date="2026-10-01")
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-sync", uid="uid-sync", title="시스템 휴일", start_date="2026-10-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider([])
    service.sync_years(start_year=2026, end_year=2026)

    detail = main_module.get_event(user_id)
    assert detail["ok"] is True
    assert detail["item"]["status"] == "active"
    assert detail["item"]["title"] == "User holiday plan"


def test_removed_upstream_holiday_archives_old_synced_event(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-removed", uid="uid-removed", title="삭제된 휴일", start_date="2026-10-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider([])
    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["archived"] == 1
    assert imported_events(main_module) == []
    archived = imported_events(main_module, mode="archived")
    assert len(archived) == 1
    assert archived[0]["title"] == "삭제된 휴일"


def test_startup_monthly_sync_registration_does_not_duplicate_jobs(main_module, monkeypatch) -> None:
    class FakeTask:
        def __init__(self) -> None:
            self.cancelled = False

        def done(self) -> bool:
            return self.cancelled

        def cancel(self) -> None:
            self.cancelled = True

    created = []

    def fake_create_task(coro):
        coro.close()
        task = FakeTask()
        created.append(task)
        return task

    monkeypatch.setattr(main_module.SETTINGS, "KOREAN_HOLIDAY_ICAL_URL", "https://example.invalid/kr.ics")

    assert main_module.start_holiday_sync_scheduler(create_task=fake_create_task) is True
    assert main_module.start_holiday_sync_scheduler(create_task=fake_create_task) is False
    assert len(created) == 1


def test_missing_or_unreachable_ical_url_fails_safely(main_module) -> None:
    missing = HolidaySyncService(main_module.items_repo, main_module.event_repo, ical_url="")
    missing_result = missing.sync_years(start_year=2026, end_year=2026)
    assert missing_result["skipped"] is True
    assert events_by_class(main_module, "claim-day")

    service = sync_service(main_module, error=OSError("network unavailable"))
    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["ok"] is False
    assert result["skipped"] is True


def test_google_korea_holidays_is_documented_default_source() -> None:
    assert (
        DEFAULT_KOREAN_HOLIDAY_ICAL_URL
        == "https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics"
    )


def test_uid_based_identity_works_correctly(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="stable-upstream-uid", uid="stable-upstream-uid", title="Old", start_date="2026-08-15")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider(
        [Holiday(external_id="stable-upstream-uid", uid="stable-upstream-uid", title="New", start_date="2026-08-16")]
    )
    service.sync_years(start_year=2026, end_year=2026)

    imported = imported_events(main_module)
    assert len(imported) == 1
    assert imported[0]["title"] == "New"
    assert imported[0]["start_date"] == "2026-08-16"


def test_ical_provider_reads_vevent_uid_summary_and_date(tmp_path: Path) -> None:
    ics_path = tmp_path / "holidays.ics"
    ics_path.write_text(
        "\n".join(
            [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "BEGIN:VEVENT",
                "UID:google-uid-1",
                "SUMMARY:개천절",
                "DTSTART;VALUE=DATE:20261003",
                "DTEND;VALUE=DATE:20261004",
                "END:VEVENT",
                "END:VCALENDAR",
            ]
        ),
        encoding="utf-8",
    )

    holidays = IcalHolidayProvider(ics_path.as_uri()).fetch_holidays(start_year=2026, end_year=2026)

    assert holidays == [
        Holiday(
            external_id="google-uid-1",
            uid="google-uid-1",
            title="개천절",
            start_date="2026-10-03",
            end_date=None,
        )
    ]
