from __future__ import annotations

import importlib
import json
import os
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "push-policy-v0.db"
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


def test_task_overdue_push_is_edge_triggered(main_module) -> None:
    web_push = _setup_push(main_module)

    task = main_module.create_task({"title": "Submit permit", "due_at": "2020-01-01T00:00:00+00:00"})

    first_scan = main_module.scan_overdue_pushes()
    assert first_scan["ok"] is True
    assert first_scan["count"] == 1
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["title"] == "Task became overdue"

    second_scan = main_module.scan_overdue_pushes()
    assert second_scan["ok"] is True
    assert second_scan["count"] == 0
    assert len(web_push.payloads) == 1

    update_future = main_module.update_task(task["id"], {"due_at": "2099-01-01T00:00:00+00:00"})
    assert update_future["ok"] is True
    reset_scan = main_module.scan_overdue_pushes()
    assert reset_scan["ok"] is True
    assert reset_scan["count"] == 0

    update_past = main_module.update_task(task["id"], {"due_at": "2020-01-02T00:00:00+00:00"})
    assert update_past["ok"] is True
    third_scan = main_module.scan_overdue_pushes()
    assert third_scan["ok"] is True
    assert third_scan["count"] == 1
    assert len(web_push.payloads) == 2


def test_fax_received_push_is_one_per_event(main_module) -> None:
    web_push = _setup_push(main_module)

    first = main_module.notify_fax_received({"fax_id": "fax-123", "event_id": "evt-1", "title": "Lab fax"})
    assert first["ok"] is True
    assert first["sent"] is True
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["title"] == "Fax received"

    duplicate = main_module.notify_fax_received({"fax_id": "fax-123", "event_id": "evt-1", "title": "Lab fax"})
    assert duplicate["ok"] is True
    assert duplicate["sent"] is False
    assert len(web_push.payloads) == 1

    second = main_module.notify_fax_received({"fax_id": "fax-123", "event_id": "evt-2", "title": "Lab fax"})
    assert second["ok"] is True
    assert second["sent"] is True
    assert len(web_push.payloads) == 2


def test_fax_send_failed_push_is_one_per_event(main_module) -> None:
    web_push = _setup_push(main_module)

    first = main_module.notify_fax_send_failed(
        {"fax_id": "fax-456", "event_id": "send-fail-1", "title": "Outbound referral"}
    )
    assert first["ok"] is True
    assert first["sent"] is True
    assert len(web_push.payloads) == 1
    assert web_push.payloads[0]["title"] == "Fax send failed"

    duplicate = main_module.notify_fax_send_failed(
        {"fax_id": "fax-456", "event_id": "send-fail-1", "title": "Outbound referral"}
    )
    assert duplicate["ok"] is True
    assert duplicate["sent"] is False
    assert len(web_push.payloads) == 1
