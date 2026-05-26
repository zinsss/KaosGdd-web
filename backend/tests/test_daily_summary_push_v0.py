from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "daily-summary-push-v0.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("APP_BASE_URL", "https://kaos.test")
    monkeypatch.setenv("APP_TIMEZONE", "Asia/Seoul")
    monkeypatch.setenv("KOREAN_HOLIDAY_ICAL_URL", "")

    import app.config as config_module
    import app.core.db as db_module
    import app.engine.reminder_service as reminder_service_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(reminder_service_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    monkeypatch.setattr(main_module, "_daily_summary_local_date", lambda: "2026-05-24")
    yield main_module
    main_module.stop_holiday_sync_scheduler()


class FakePushSubscriptionRepo:
    def __init__(self, count: int = 1) -> None:
        self.rows = [
            {
                "client_id": f"client-{index}",
                "endpoint": f"https://push.example/sub/{index}",
                "subscription": {"endpoint": f"https://push.example/sub/{index}", "keys": {}},
            }
            for index in range(count)
        ]
        self.removed: list[tuple[str, str]] = []

    def list_all(self):
        return list(self.rows)

    def remove(self, *, client_id: str, endpoint: str):
        self.removed.append((client_id, endpoint))
        return True


class FakeWebPushClient:
    is_enabled = True

    def __init__(self, fail_endpoint: str | None = None) -> None:
        self.fail_endpoint = fail_endpoint
        self.payloads: list[dict] = []

    def send(self, *, subscription_info: dict, payload_json: str):
        if self.fail_endpoint and subscription_info.get("endpoint") == self.fail_endpoint:
            raise RuntimeError("push failed")
        self.payloads.append(json.loads(payload_json))

    def summarize_exception(self, exc: Exception):
        return {
            "exception_type": type(exc).__name__,
            "message": str(exc),
            "summary": str(exc),
            "is_invalid_subscription": False,
        }


def _summary(*, flags: dict | None = None) -> dict:
    return {
        "date": "2026.05.24 Sun",
        "tasks": {"active_total": 12, "overdue": 2, "today": 5},
        "reminders": {"today": 3, "missed": 1, "fired": 0},
        "events_today": ["Clinic", "Call"],
        "supplies": {"active_total": 4},
        "fax": {"active_total": 0, "attention": 0},
        "flags": flags or {"public_holiday": False, "market_day": False, "claim_day": False},
    }


def _setup(main_module, monkeypatch: pytest.MonkeyPatch, *, summary: dict | None = None, subscriptions: int = 1):
    repo = FakePushSubscriptionRepo(count=subscriptions)
    web_push = FakeWebPushClient()
    monkeypatch.setattr(main_module, "push_subscription_repo", repo)
    monkeypatch.setattr(main_module, "web_push_client", web_push)
    monkeypatch.setattr(main_module.dashboard_service, "get_widget_summary", lambda: summary or _summary())
    return repo, web_push


def test_daily_summary_config_defaults_and_invalid_hhmm_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DAILY_SUMMARY_MORNING_TIME", raising=False)
    monkeypatch.delenv("DAILY_SUMMARY_LUNCH_TIME", raising=False)
    monkeypatch.delenv("DAILY_SUMMARY_BEFORE_OFF_TIME", raising=False)
    monkeypatch.delenv("DAILY_SUMMARY_BEFORE_SLEEP_TIME", raising=False)
    monkeypatch.delenv("DAILY_SUMMARY_BODY_MAX_LINES", raising=False)
    monkeypatch.delenv("DAILY_SUMMARY_FLAGS_FIRST", raising=False)

    import app.config as config_module

    importlib.reload(config_module)

    assert config_module.SETTINGS.DAILY_SUMMARY_MORNING_TIME == "08:30"
    assert config_module.SETTINGS.DAILY_SUMMARY_LUNCH_TIME == "13:05"
    assert config_module.SETTINGS.DAILY_SUMMARY_BEFORE_OFF_TIME == "17:15"
    assert config_module.SETTINGS.DAILY_SUMMARY_BEFORE_SLEEP_TIME == "22:00"
    assert config_module.SETTINGS.DAILY_SUMMARY_BODY_MAX_LINES == 3
    assert config_module.SETTINGS.DAILY_SUMMARY_FLAGS_FIRST is True

    monkeypatch.setenv("DAILY_SUMMARY_MORNING_TIME", "25:99")
    monkeypatch.setenv("DAILY_SUMMARY_LUNCH_TIME", "not-time")
    monkeypatch.setenv("DAILY_SUMMARY_BEFORE_OFF_TIME", "7:15")
    monkeypatch.setenv("DAILY_SUMMARY_BEFORE_SLEEP_TIME", "22:60")

    importlib.reload(config_module)

    assert config_module.SETTINGS.DAILY_SUMMARY_MORNING_TIME == "08:30"
    assert config_module.SETTINGS.DAILY_SUMMARY_LUNCH_TIME == "13:05"
    assert config_module.SETTINGS.DAILY_SUMMARY_BEFORE_OFF_TIME == "17:15"
    assert config_module.SETTINGS.DAILY_SUMMARY_BEFORE_SLEEP_TIME == "22:00"


def test_valid_slots_accepted_and_titles_differ(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = {
        "morning": "KaosGdd Morning",
        "lunch": "KaosGdd Lunch",
        "before-off": "KaosGdd Before Off",
        "before-sleep": "KaosGdd Night",
    }
    titles = {}
    for index, slot in enumerate(expected):
        monkeypatch.setattr(main_module, "_daily_summary_local_date", lambda index=index: f"2026-05-{24 + index:02d}")
        _, web_push = _setup(main_module, monkeypatch)
        result = main_module.send_daily_summary({"slot": slot})
        assert result["ok"] is True
        assert result["slot"] == slot
        assert result["sent"] == 1
        titles[slot] = web_push.payloads[-1]["title"]

    assert titles == expected
    assert len(set(titles.values())) == 4


def test_invalid_slot_rejected(main_module) -> None:
    result = main_module.send_daily_summary({"slot": "brunch"})
    assert result["ok"] is False
    assert result["sent"] == 0
    assert result["skipped"] == 0
    assert result["error"] == "invalid slot"
    assert "brunch" == result["slot"]
    assert set(result["supported_slots"]) == set(main_module.DAILY_SUMMARY_SLOTS)


def test_body_formatting_includes_counts_and_omits_flags_when_false(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(main_module, monkeypatch)
    result = main_module.send_daily_summary({"slot": "morning"})

    assert result["ok"] is True
    assert web_push.payloads[0]["body"] == "Tasks 12 · Overdue 2\nReminders 3 · Events 2\nSupplies 4 · Fax 0"


def test_body_formatting_includes_flags_line_when_true(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(
        main_module,
        monkeypatch,
        summary=_summary(flags={"public_holiday": False, "market_day": True, "claim_day": True}),
    )
    result = main_module.send_daily_summary({"slot": "morning"})

    assert result["ok"] is True
    assert web_push.payloads[0]["body"] == "Market Day · Claim Day\nTasks 12 · Overdue 2\nReminders 3 · Events 2 · Supplies 4 · Fax 0"


def test_same_slot_dedupes_on_same_local_date(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(main_module, monkeypatch)

    first = main_module.send_daily_summary({"slot": "morning"})
    second = main_module.send_daily_summary({"slot": "morning"})

    assert first["sent"] == 1
    assert first["skipped"] == 0
    assert second["sent"] == 0
    assert second["skipped"] == 1
    assert len(web_push.payloads) == 1


def test_different_slots_can_send_on_same_local_date(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(main_module, monkeypatch)

    morning = main_module.send_daily_summary({"slot": "morning"})
    lunch = main_module.send_daily_summary({"slot": "lunch"})

    assert morning["sent"] == 1
    assert lunch["sent"] == 1
    assert [payload["title"] for payload in web_push.payloads] == ["KaosGdd Morning", "KaosGdd Lunch"]


def test_same_slot_sends_again_next_local_date(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(main_module, monkeypatch)

    first = main_module.send_daily_summary({"slot": "before-sleep"})
    monkeypatch.setattr(main_module, "_daily_summary_local_date", lambda: "2026-05-25")
    second = main_module.send_daily_summary({"slot": "before-sleep"})

    assert first["sent"] == 1
    assert second["sent"] == 1
    assert len(web_push.payloads) == 2


def test_deep_link_points_to_root_dashboard(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    _, web_push = _setup(main_module, monkeypatch)

    result = main_module.send_daily_summary({"slot": "morning"})

    assert result["ok"] is True
    assert web_push.payloads[0]["url"] == "https://kaos.test/"


def test_endpoint_returns_useful_sent_skipped_and_error_counts(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    repo = FakePushSubscriptionRepo(count=2)
    web_push = FakeWebPushClient(fail_endpoint="https://push.example/sub/1")
    monkeypatch.setattr(main_module, "push_subscription_repo", repo)
    monkeypatch.setattr(main_module, "web_push_client", web_push)
    monkeypatch.setattr(main_module.dashboard_service, "get_widget_summary", lambda: _summary())

    result = main_module.send_daily_summary({"slot": "lunch"})

    assert result["ok"] is True
    assert result["sent"] == 1
    assert result["skipped"] == 0
    assert result["error_count"] == 1
    assert len(result["errors"]) == 1
    assert result["errors"][0]["endpoint"] == "https://push.example/sub/1"
