from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "pushover-reminder-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["PUSHOVER_ENABLED"] = "1"
    os.environ["PUSHOVER_APP_TOKEN"] = "app-token"
    os.environ["PUSHOVER_USER_KEY"] = "user-key"
    os.environ["PUSHOVER_DELAY_SECONDS"] = "0"
    os.environ["APP_BASE_URL"] = "https://kaos.test"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_send_pushover_skips_when_disabled_or_unconfigured() -> None:
    os.environ["PUSHOVER_ENABLED"] = "0"
    os.environ["PUSHOVER_APP_TOKEN"] = "app-token"
    os.environ["PUSHOVER_USER_KEY"] = "user-key"

    import app.config as config_module
    import app.integrations.pushover_client as push_module

    importlib.reload(config_module)
    importlib.reload(push_module)

    disabled_result = push_module.send_pushover(title="x", message="y")
    assert disabled_result["attempted"] is False
    assert disabled_result["reason"] == "disabled"

    os.environ["PUSHOVER_ENABLED"] = "1"
    os.environ["PUSHOVER_APP_TOKEN"] = ""

    importlib.reload(config_module)
    importlib.reload(push_module)

    missing_result = push_module.send_pushover(title="x", message="y")
    assert missing_result["attempted"] is False
    assert missing_result["reason"] == "missing credentials"


def test_fire_due_reminder_calls_push_sender(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    task = main_module.create_task({"title": "Pay rent"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    calls: list[dict] = []

    def fake_send(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.engine.reminder_service.send_pushover", fake_send)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    assert len(calls) == 1
    assert calls[0]["title"] == "Task Reminder"
    assert "Pay rent" in calls[0]["message"]
    assert "Remind:" in calls[0]["message"]


def test_push_failure_does_not_rollback_fired_state(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    ok, _status, reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="backup passport",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True

    def fake_send(**_kwargs):
        return {"attempted": True, "succeeded": False, "reason": "network error"}

    monkeypatch.setattr("app.engine.reminder_service.send_pushover", fake_send)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    detail = main_module.get_reminder(reminder_id)
    assert detail["ok"] is True
    assert detail["item"]["state"] == "fired"


def test_standalone_payload_has_basic_title_and_body(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    ok, _status, _reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="buy batteries",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True

    calls: list[dict] = []

    def fake_send(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.engine.reminder_service.send_pushover", fake_send)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    assert len(calls) == 1
    assert calls[0]["title"] == "Reminder"
    assert "buy batteries" in calls[0]["message"]
    assert "Remind:" in calls[0]["message"]


def test_fire_due_reminder_sends_web_push_before_delayed_pushover(
    main_module, monkeypatch: pytest.MonkeyPatch
) -> None:
    task = main_module.create_task({"title": "Renew passport"})
    assert task["ok"] is True

    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    calls: list[str] = []

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
            calls.append(f"remove:{client_id}:{endpoint}")
            return True

    class FakeWebPushClient:
        is_enabled = True

        def send(self, *, subscription_info: dict, payload_json: str):
            assert subscription_info["endpoint"] == "https://push.example/sub/1"
            assert "Task Reminder" in payload_json
            calls.append("web_push")

    def fake_delay():
        calls.append("delay")

    def fake_send_pushover(**kwargs):
        assert kwargs["title"] == "Task Reminder"
        calls.append("pushover")
        return {"attempted": True, "succeeded": True, "reason": None}

    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = FakeWebPushClient()
    monkeypatch.setattr(main_module.reminder_service, "_delay_before_pushover", fake_delay)
    monkeypatch.setattr("app.engine.reminder_service.send_pushover", fake_send_pushover)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert calls == ["web_push", "delay", "pushover"]
