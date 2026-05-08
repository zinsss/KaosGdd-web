from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "pushover-reminder-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("PUSHOVER_ENABLED", "1")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")
    monkeypatch.setenv("APP_BASE_URL", "https://kaos.test")

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
    def __init__(self) -> None:
        self.removed: list[tuple[str, str]] = []

    def list_all(self):
        return [
            {
                "client_id": "client-1",
                "endpoint": "https://push.example/sub/1",
                "subscription": {"endpoint": "https://push.example/sub/1", "keys": {}},
            }
        ]

    def remove(self, *, client_id: str, endpoint: str):
        self.removed.append((client_id, endpoint))
        return True


class FakeWebPushClient:
    is_enabled = True

    def __init__(self) -> None:
        self.payloads: list[dict] = []

    def send(self, *, subscription_info: dict, payload_json: str):
        assert subscription_info["endpoint"] == "https://push.example/sub/1"
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


def test_send_pushover_skips_when_disabled_or_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PUSHOVER_ENABLED", "0")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")

    import app.config as config_module
    import app.integrations.pushover_client as push_module

    importlib.reload(config_module)
    importlib.reload(push_module)

    disabled_result = push_module.send_pushover(title="x", message="y")
    assert disabled_result["attempted"] is False
    assert disabled_result["reason"] == "disabled"

    monkeypatch.setenv("PUSHOVER_ENABLED", "1")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "")

    importlib.reload(config_module)
    importlib.reload(push_module)

    missing_result = push_module.send_pushover(title="x", message="y")
    assert missing_result["attempted"] is False
    assert missing_result["reason"] == "missing credentials"


def test_fire_due_reminder_uses_web_push_not_pushover(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    task = main_module.create_task({"title": "Pay rent"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_web_push(main_module)

    def fail_pushover(**_kwargs):
        raise AssertionError("ordinary reminder events must not use Pushover")

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover", fail_pushover)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["title"] == "Task Reminder"
    assert "Pay rent" in web_push.payloads[0]["body"]
    assert "Remind:" in web_push.payloads[0]["body"]


def test_web_push_failure_does_not_rollback_fired_state(main_module) -> None:
    ok, _status, reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="backup passport",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True

    class FailingWebPushClient(FakeWebPushClient):
        def send(self, *, subscription_info: dict, payload_json: str):
            raise RuntimeError("network error")

    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = FailingWebPushClient()

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    detail = main_module.get_reminder(reminder_id)
    assert detail["ok"] is True
    assert detail["item"]["state"] == "fired"


def test_standalone_payload_has_basic_title_and_body(main_module) -> None:
    ok, _status, _reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="buy batteries",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True

    web_push = _setup_web_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["title"] == "Reminder"
    assert "buy batteries" in web_push.payloads[0]["body"]
    assert "Remind:" in web_push.payloads[0]["body"]


def test_reminder_web_push_deeplink_targets_fired_mode_with_reminder_id(main_module) -> None:
    task = main_module.create_task({"title": "Doctor follow-up"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_web_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["url"] == f"https://kaos.test/reminders?mode=fired&reminder_id={reminder['id']}"


def test_fire_due_reminder_sends_only_web_push_for_app_event(main_module) -> None:
    task = main_module.create_task({"title": "Renew passport"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    calls: list[str] = []

    class RecordingWebPushClient(FakeWebPushClient):
        def send(self, *, subscription_info: dict, payload_json: str):
            super().send(subscription_info=subscription_info, payload_json=payload_json)
            calls.append("web_push")

    web_push = RecordingWebPushClient()
    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = web_push

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert calls == ["web_push"]


def test_web_push_payload_includes_binary_attention_badge_set(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    task = main_module.create_task({"title": "Badge count task"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_web_push(main_module)

    monkeypatch.setattr(main_module.reminder_service, "_has_app_attention", lambda: True)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["badge_count"] == 1
    assert web_push.payloads[0]["has_app_attention"] is True


def test_web_push_payload_includes_binary_attention_badge_clear(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    task = main_module.create_task({"title": "Clear badge task"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_web_push(main_module)

    monkeypatch.setattr(main_module.reminder_service, "_has_app_attention", lambda: False)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["badge_count"] == 0
    assert web_push.payloads[0]["has_app_attention"] is False
