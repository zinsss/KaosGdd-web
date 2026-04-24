from __future__ import annotations

import importlib
import os
from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "push-diagnostics-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["WEB_PUSH_VAPID_PUBLIC_KEY"] = "test-public"
    os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = "test-private"
    os.environ["WEB_PUSH_SUBJECT"] = "mailto:test@example.com"

    import app.config as config_module
    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


class _FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class _InvalidSubscriptionError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.response = _FakeResponse(status_code)


def test_summarize_exception_classifies_invalid_subscription(main_module) -> None:
    exc = _InvalidSubscriptionError("Subscription is gone", 410)
    details = main_module.web_push_client.summarize_exception(exc)
    assert details["exception_type"] == "_InvalidSubscriptionError"
    assert details["status_code"] == 410
    assert details["is_invalid_subscription"] is True


def test_summarize_exception_keeps_transient_errors(main_module) -> None:
    details = main_module.web_push_client.summarize_exception(RuntimeError("temporary gateway timeout"))
    assert details["status_code"] is None
    assert details["is_invalid_subscription"] is False


def test_push_test_returns_errors_without_removing_on_generic_failure(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    sub = {
        "endpoint": "https://push.example/sub/1",
        "keys": {"p256dh": "k1", "auth": "a1"},
    }
    saved = main_module.save_push_subscription({"client_id": "c1", "subscription": sub})
    assert saved["ok"] is True

    def fail_send(**_kwargs):
        raise RuntimeError("temporary upstream failure")

    monkeypatch.setattr(main_module.web_push_client, "send", fail_send)

    result = main_module.send_push_test({"client_id": "c1", "endpoint": sub["endpoint"]})
    assert result["ok"] is False
    assert result["removed"] == 0
    assert result["endpoint_match"] is True
    assert len(result["errors"]) == 1
    assert result["errors"][0]["removed_due_to_invalid"] is False

    status = main_module.get_push_status(client_id="c1", endpoint=sub["endpoint"])
    assert status["ok"] is True
    assert status["backend_subscription_saved"] is True
    assert status["endpoint_match"] is True
    assert status["last_test"]["ok"] is False
    assert status["last_test"]["first_error_summary"]


def test_push_test_removes_subscription_on_invalid_failure(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    sub = {
        "endpoint": "https://push.example/sub/2",
        "keys": {"p256dh": "k2", "auth": "a2"},
    }
    saved = main_module.save_push_subscription({"client_id": "c2", "subscription": sub})
    assert saved["ok"] is True

    def fail_send(**_kwargs):
        raise _InvalidSubscriptionError("expired", 410)

    monkeypatch.setattr(main_module.web_push_client, "send", fail_send)

    result = main_module.send_push_test({"client_id": "c2", "endpoint": sub["endpoint"]})
    assert result["ok"] is False
    assert result["removed"] == 1
    assert result["errors"][0]["removed_due_to_invalid"] is True
    assert result["errors"][0]["removed"] is True

    status = main_module.get_push_status(client_id="c2", endpoint=sub["endpoint"])
    assert status["backend_subscription_saved"] is False
    assert status["endpoint_match"] is False
    assert status["last_test"]["removed"] == 1


def test_save_push_subscription_replaces_older_client_subscription(main_module) -> None:
    sub_1 = {
        "endpoint": "https://push.example/sub/old",
        "keys": {"p256dh": "old-k", "auth": "old-a"},
    }
    sub_2 = {
        "endpoint": "https://push.example/sub/new",
        "keys": {"p256dh": "new-k", "auth": "new-a"},
    }

    assert main_module.save_push_subscription({"client_id": "single-client", "subscription": sub_1})["ok"] is True
    assert main_module.save_push_subscription({"client_id": "single-client", "subscription": sub_2})["ok"] is True

    rows = main_module.push_subscription_repo.list_for_client("single-client")
    assert len(rows) == 1
    assert rows[0]["endpoint"] == sub_2["endpoint"]
