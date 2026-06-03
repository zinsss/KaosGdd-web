from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "notification-preferences-v0.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("APP_BASE_URL", "https://kaos.test")
    monkeypatch.setenv("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", "0")
    monkeypatch.setenv("PUSHOVER_ENABLED", "1")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_ENABLED", "1")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")

    import app.config as config_module
    import app.core.db as db_module
    import app.engine.reminder_service as reminder_service_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(reminder_service_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


class FakePushSubscriptionRepo:
    def list_all(self):
        return [
            {
                "client_id": "client-1",
                "endpoint": "https://push.example/sub/1",
                "subscription": {"endpoint": "https://push.example/sub/1", "keys": {}},
            }
        ]

    def remove(self, *, client_id: str, endpoint: str):
        return True


class FakeWebPushClient:
    is_enabled = True

    def __init__(self) -> None:
        self.payloads: list[dict] = []

    def send(self, *, subscription_info: dict, payload_json: str):
        self.payloads.append(json.loads(payload_json))

    def summarize_exception(self, exc: Exception):
        return {
            "exception_type": type(exc).__name__,
            "message": str(exc),
            "is_invalid_subscription": False,
        }


def _setup_web_push(main_module) -> FakeWebPushClient:
    web_push = FakeWebPushClient()
    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = web_push
    return web_push


def _record_pushover(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    calls: list[dict] = []

    def fake_pushover(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", fake_pushover)
    return calls


def test_notification_preferences_default_and_update(main_module) -> None:
    initial = main_module.get_notification_preferences()
    assert initial["ok"] is True
    assert initial["preferences"]["mode"] == "pushover_primary"
    assert initial["supported_modes"] == ["pushover_primary", "web_push_only", "pushover_only"]

    updated = main_module.update_notification_preferences({"mode": "web_push_only"})
    assert updated["ok"] is True
    assert updated["preferences"]["mode"] == "web_push_only"

    primary = main_module.update_notification_preferences({"mode": "pushover_primary"})
    assert primary["ok"] is True
    assert primary["preferences"]["mode"] == "pushover_primary"

    invalid = main_module.update_notification_preferences({"mode": "sms"})
    assert invalid["ok"] is False
    assert invalid["error"] == "invalid notification mode"

    legacy = main_module.update_notification_preferences({"mode": "hybrid"})
    assert legacy["ok"] is False
    assert legacy["error"] == "invalid notification mode"


def test_legacy_hybrid_mode_normalizes_to_pushover_primary() -> None:
    from app.db.repo.push_policy_repo import normalize_notification_mode

    assert normalize_notification_mode("hybrid") == "pushover_primary"


@pytest.mark.parametrize(
    ("mode", "expected_web", "expected_pushover"),
    [
        ("web_push_only", 1, 0),
        ("pushover_only", 0, 1),
        ("pushover_primary", 1, 1),
    ],
)
def test_normal_fired_reminder_routes_by_notification_mode(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    expected_web: int,
    expected_pushover: int,
) -> None:
    main_module.update_notification_preferences({"mode": mode})
    ok, _status, _reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="normal reminder",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True
    web_push = _setup_web_push(main_module)
    pushover_calls = _record_pushover(monkeypatch)

    fired = main_module.fire_due_reminders()

    assert fired["ok"] is True
    assert fired["count"] == 1
    assert len(web_push.payloads) == expected_web
    assert len(pushover_calls) == expected_pushover


@pytest.mark.parametrize(
    ("mode", "expected_web", "expected_pushover"),
    [
        ("web_push_only", 1, 0),
        ("pushover_only", 0, 1),
        ("pushover_primary", 0, 1),
    ],
)
def test_missed_reminder_routes_by_notification_mode(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    expected_web: int,
    expected_pushover: int,
) -> None:
    main_module.update_notification_preferences({"mode": mode})
    ok, _status, _reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="missed reminder",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True
    web_push = _setup_web_push(main_module)
    pushover_calls = _record_pushover(monkeypatch)
    main_module.fire_due_reminders()
    web_push.payloads.clear()
    pushover_calls.clear()

    missed = main_module.scan_missed_reminders()

    assert missed["ok"] is True
    assert missed["count"] == 1
    assert len(web_push.payloads) == expected_web
    assert len(pushover_calls) == expected_pushover


def test_overdue_task_uses_pushover_in_pushover_primary(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    main_module.update_notification_preferences({"mode": "pushover_primary"})
    task = main_module.create_task({"title": "Submit overdue form", "due_at": "2020-01-01T00:00:00+00:00"})
    assert task["ok"] is True
    web_push = _setup_web_push(main_module)
    pushover_calls = _record_pushover(monkeypatch)

    scanned = main_module.scan_overdue_pushes()

    assert scanned["ok"] is True
    assert scanned["count"] == 1
    assert web_push.payloads == []
    assert len(pushover_calls) == 1
    assert pushover_calls[0]["title"] == "KaosGdd task overdue"


@pytest.mark.parametrize(
    ("mode", "expected_web", "expected_pushover"),
    [
        ("web_push_only", 1, 0),
        ("pushover_only", 0, 1),
        ("pushover_primary", 0, 1),
    ],
)
def test_fax_received_routes_by_notification_mode(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    expected_web: int,
    expected_pushover: int,
) -> None:
    main_module.update_notification_preferences({"mode": mode})
    web_push = _setup_web_push(main_module)
    pushover_calls = _record_pushover(monkeypatch)

    sent = main_module.notify_fax_received({"fax_id": "fax-1", "event_id": "evt-1", "title": "Clinic fax"})

    assert sent["ok"] is True
    assert sent["sent"] is True
    assert len(web_push.payloads) == expected_web
    assert len(pushover_calls) == expected_pushover
    if expected_web:
        assert web_push.payloads[0]["title"] == "Fax received"
    if expected_pushover:
        assert pushover_calls[0]["title"] == "KaosGdd fax received"


@pytest.mark.parametrize(
    ("mode", "expected_web", "expected_pushover"),
    [
        ("web_push_only", 1, 0),
        ("pushover_only", 0, 1),
        ("pushover_primary", 0, 1),
    ],
)
def test_fax_send_failed_routes_by_notification_mode(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    expected_web: int,
    expected_pushover: int,
) -> None:
    main_module.update_notification_preferences({"mode": mode})
    web_push = _setup_web_push(main_module)
    pushover_calls = _record_pushover(monkeypatch)

    sent = main_module.notify_fax_send_failed(
        {"fax_id": "fax-2", "event_id": "evt-2", "title": "Referral fax", "target": "02"}
    )

    assert sent["ok"] is True
    assert sent["sent"] is True
    assert len(web_push.payloads) == expected_web
    assert len(pushover_calls) == expected_pushover
    if expected_web:
        assert web_push.payloads[0]["title"] == "Fax send failed"
    if expected_pushover:
        assert pushover_calls[0]["title"] == "KaosGdd fax failed"
