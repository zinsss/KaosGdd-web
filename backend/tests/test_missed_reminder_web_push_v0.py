from __future__ import annotations

import importlib
import json
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "missed-reminder-web-push.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["REMINDER_MISSED_SCAN_LOOKBACK_HOURS"] = "0"
    os.environ["APP_BASE_URL"] = "https://kaos.test"

    import app.config as config_module
    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
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

    def __init__(self):
        self.payloads: list[dict] = []

    def send(self, *, subscription_info: dict, payload_json: str):
        assert subscription_info["endpoint"] == "https://push.example/sub/1"
        self.payloads.append(json.loads(payload_json))


def _setup_push(main_module):
    web_push = FakeWebPushClient()
    main_module.reminder_service.push_subscription_repo = FakePushSubscriptionRepo()
    main_module.reminder_service.web_push_client = web_push
    return web_push


def test_fired_to_missed_transition_sends_second_web_push(main_module) -> None:
    task = main_module.create_task({"title": "Pay electricity bill"})
    create_result = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert create_result["ok"] is True

    web_push = _setup_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1
    assert len(web_push.payloads) == 1

    missed = main_module.scan_missed_reminders()
    assert missed["ok"] is True
    assert missed["count"] == 1
    assert len(web_push.payloads) == 2


def test_missed_push_uses_expected_title_and_deep_link(main_module) -> None:
    task = main_module.create_task({"title": "Dentist check-in"})
    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    missed = main_module.scan_missed_reminders()
    assert missed["ok"] is True

    assert len(web_push.payloads) == 2
    missed_payload = web_push.payloads[1]
    assert missed_payload["title"] == "You have missed reminder"
    assert missed_payload["url"] == f"https://kaos.test/reminders?mode=fired&reminder_id={reminder['id']}"


def test_missed_scan_does_not_resend_for_already_missed_reminder(main_module) -> None:
    ok, _status, reminder_id = main_module.reminder_service.create_standalone_reminder(
        title="File taxes",
        remind_at="2020-01-01T00:00:00+00:00",
    )
    assert ok is True

    web_push = _setup_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    first_scan = main_module.scan_missed_reminders()
    assert first_scan["ok"] is True
    assert first_scan["count"] == 1

    second_scan = main_module.scan_missed_reminders()
    assert second_scan["ok"] is True
    assert second_scan["count"] == 0

    assert len(web_push.payloads) == 2

    detail = main_module.get_reminder(reminder_id)
    assert detail["ok"] is True
    assert detail["item"]["state"] == "missed"


def test_resolved_fired_reminders_do_not_get_missed_push(main_module) -> None:
    task = main_module.create_task({"title": "Send status report"})
    reminder = main_module.create_task_reminder(task["id"], {"remind_at": "2020-01-01T00:00:00+00:00"})
    assert reminder["ok"] is True

    web_push = _setup_push(main_module)

    fired = main_module.fire_due_reminders()
    assert fired["ok"] is True
    assert fired["count"] == 1

    acked = main_module.ack_reminder(reminder["id"])
    assert acked["ok"] is True

    missed = main_module.scan_missed_reminders()
    assert missed["ok"] is True
    assert missed["count"] == 0

    assert len(web_push.payloads) == 1
