from __future__ import annotations

import importlib
import json
import logging
from pathlib import Path
from urllib import parse

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "pushover-emergency-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", "0")
    monkeypatch.setenv("PUSHOVER_ENABLED", "true")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_ENABLED", "true")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_RETRY_SECONDS", "60")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_EXPIRE_SECONDS", "1800")
    monkeypatch.setenv("APP_BASE_URL", "https://kaos.test")

    import app.config as config_module
    import app.core.db as db_module
    import app.engine.reminder_service as reminder_service_module
    import app.integrations.pushover_client as pushover_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(pushover_module)
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
            "summary": str(exc),
            "is_invalid_subscription": False,
        }


def _setup_web_push(main_module) -> FakeWebPushClient:
    web_push = FakeWebPushClient()
    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = web_push
    return web_push


def _fire_then_scan_missed(main_module):
    task = main_module.create_task(
        {
            "title": "Call pharmacy",
            "due_at": "2099-01-01T09:00:00+00:00",
            "memo": "Call before lunch.\nBring insurance number.",
        }
    )
    assert task["ok"] is True
    main_module.items_repo.replace_item_tags(task["id"], ["clinic", "fax"])
    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T08:30:00+00:00"})
    assert reminder["ok"] is True
    _setup_web_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    missed = main_module.scan_missed_reminders()
    assert missed["ok"] is True
    return reminder, missed


def test_missed_reminder_sends_pushover_emergency_when_enabled(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def record_emergency(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", record_emergency)

    _, missed = _fire_then_scan_missed(main_module)

    assert missed["count"] == 1
    assert len(calls) == 1
    assert calls[0]["title"] == "KaosGdd missed reminder"
    assert "TASK • Call pharmacy" in calls[0]["message"]
    assert "State    │ missed" in calls[0]["message"]
    assert "Due      │ 2099-01-01 18:00" in calls[0]["message"]
    assert "Reminder │ 2020-01-01 17:30" in calls[0]["message"]
    assert "Tags     │ #clinic #fax" in calls[0]["message"]
    assert "Memo\nCall before lunch.\nBring insurance number." in calls[0]["message"]
    assert "Open\nhttps://kaos.test/reminders?mode=fired&reminder_id=" in calls[0]["message"]
    assert len(calls[0]["message"].encode("utf-8")) <= 1024
    assert calls[0]["monospace"] is True
    assert calls[0]["url"].startswith("https://kaos.test/reminders?mode=fired&reminder_id=")


def test_overdue_task_sends_rich_pushover_emergency_when_enabled(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    def record_emergency(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", record_emergency)
    _setup_web_push(main_module)

    task = main_module.create_task(
        {
            "title": "Send referral fax",
            "due_at": "2020-01-01T09:00:00+00:00",
            "memo": "Call before lunch.",
        }
    )
    assert task["ok"] is True
    main_module.items_repo.replace_item_tags(task["id"], ["clinic", "fax"])

    scanned = main_module.scan_overdue_pushes()

    assert scanned["ok"] is True
    assert scanned["count"] == 1
    assert len(calls) == 1
    assert calls[0]["title"] == "KaosGdd task overdue"
    assert calls[0]["message"] == (
        "TASK • Send referral fax\n"
        "State    │ overdue\n"
        "Due      │ 2020-01-01 18:00\n"
        "Tags     │ #clinic #fax\n"
        "Memo\n"
        "Call before lunch.\n"
        "Open\n"
        f"https://kaos.test/tasks/{task['id']}"
    )
    assert calls[0]["monospace"] is True
    assert calls[0]["url"] == f"https://kaos.test/tasks/{task['id']}"


def test_missed_reminder_does_not_send_pushover_when_disabled(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path = tmp_path / "pushover-emergency-disabled-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", "0")
    monkeypatch.setenv("PUSHOVER_ENABLED", "true")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_ENABLED", "false")

    import app.config as config_module
    import app.core.db as db_module
    import app.engine.reminder_service as reminder_service_module
    import app.integrations.pushover_client as pushover_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(pushover_module)
    importlib.reload(reminder_service_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)

    def fail_send_pushover(**_kwargs):
        raise AssertionError("disabled Pushover Emergency must not call the API sender")

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover", fail_send_pushover)

    _, missed = _fire_then_scan_missed(main_module)

    assert missed["count"] == 1


def test_missed_reminder_does_not_repeat_pushover_on_later_scans(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    def record_emergency(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", record_emergency)

    _, first = _fire_then_scan_missed(main_module)
    second = main_module.scan_missed_reminders()

    assert first["count"] == 1
    assert second["count"] == 0
    assert len(calls) == 1


def test_fax_send_failed_sends_pushover_emergency_when_enabled(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    def record_emergency(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", record_emergency)
    _setup_web_push(main_module)

    result = main_module.notify_fax_send_failed(
        {
            "fax_id": "fax-123",
            "event_id": "send-failed-1",
            "title": "Referral.pdf",
            "fax_number": "02-1234-5678",
            "error_message": "modem busy",
        }
    )

    assert result["ok"] is True
    assert result["sent"] is True
    assert len(calls) == 1
    assert calls[0]["title"] == "KaosGdd fax failed"
    assert calls[0]["message"] == (
        "FAX • Send failed\n"
        "Target   │ 02-1234-5678\n"
        "File     │ Referral.pdf\n"
        "Status   │ failed\n"
        "Reason   │ modem busy\n"
        "Open\n"
        "https://kaos.test/fax"
    )
    assert calls[0]["monospace"] is True
    assert calls[0]["url"] == "https://kaos.test/fax"


def test_fax_send_failed_pushover_message_preserves_open_url_when_truncated(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    def record_emergency(**kwargs):
        calls.append(kwargs)
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", record_emergency)
    _setup_web_push(main_module)

    result = main_module.notify_fax_send_failed(
        {
            "fax_id": "fax-long",
            "event_id": "send-failed-long",
            "title": "Referral.pdf",
            "fax_number": "02-1234-5678",
            "error_message": "modem busy " * 200,
        }
    )

    assert result["ok"] is True
    assert result["sent"] is True
    assert len(calls) == 1
    assert len(calls[0]["message"].encode("utf-8")) <= 1024
    assert "Reason   │ modem busy" in calls[0]["message"]
    assert "...\nOpen\nhttps://kaos.test/fax" in calls[0]["message"]


def test_pushover_emergency_payload_includes_priority_retry_and_expire(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUSHOVER_ENABLED", "true")
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "app-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "user-key")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_ENABLED", "true")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_RETRY_SECONDS", "90")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_EXPIRE_SECONDS", "900")

    import app.config as config_module
    import app.integrations.pushover_client as pushover_module

    importlib.reload(config_module)
    importlib.reload(pushover_module)

    captured = {}

    class FakeResponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return b'{"status":1}'

    def fake_urlopen(req, timeout):
        captured["timeout"] = timeout
        captured["payload"] = parse.parse_qs(req.data.decode("utf-8"))
        return FakeResponse()

    monkeypatch.setattr(pushover_module.request, "urlopen", fake_urlopen)

    result = pushover_module.send_pushover_emergency(title="Emergency", message="Body", monospace=True)

    assert result["succeeded"] is True
    assert captured["payload"]["priority"] == ["2"]
    assert captured["payload"]["retry"] == ["90"]
    assert captured["payload"]["expire"] == ["900"]
    assert captured["payload"]["monospace"] == ["1"]


def test_pushover_failure_is_logged_and_does_not_crash_scheduler(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def fail_emergency(**_kwargs):
        return {"attempted": True, "succeeded": False, "reason": "network error"}

    monkeypatch.setattr("app.integrations.pushover_client.send_pushover_emergency", fail_emergency)

    with caplog.at_level(logging.WARNING):
        _, missed = _fire_then_scan_missed(main_module)

    assert missed["count"] == 1
    assert "pushover emergency escalation failed" in caplog.text


def test_pushover_test_endpoint_sends_non_emergency_config_test(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    def record_pushover(**kwargs):
        calls.append(kwargs)
        return {
            "attempted": True,
            "succeeded": True,
            "reason": None,
            "status": 200,
            "response": {"status": 1},
        }

    monkeypatch.setattr(main_module.pushover_client, "send_pushover", record_pushover)

    result = main_module.send_pushover_test()

    assert result == {
        "ok": True,
        "attempted": True,
        "succeeded": True,
        "reason": None,
        "status": 200,
        "response": {"status": 1},
    }
    assert calls == [
        {
            "title": "KaosGdd Pushover Test",
            "message": "Pushover is connected.",
            "url": "https://kaos.test",
            "url_title": "Open KaosGdd",
            "priority": 0,
        }
    ]


def test_pushover_test_endpoint_reports_disabled_config(
    main_module,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def disabled_pushover(**_kwargs):
        return {"attempted": False, "succeeded": False, "reason": "disabled"}

    monkeypatch.setattr(main_module.pushover_client, "send_pushover", disabled_pushover)

    result = main_module.send_pushover_test()

    assert result["ok"] is False
    assert result["attempted"] is False
    assert result["succeeded"] is False
    assert result["reason"] == "disabled"
