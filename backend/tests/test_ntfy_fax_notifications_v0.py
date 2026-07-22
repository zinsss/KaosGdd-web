from __future__ import annotations

import importlib
from pathlib import Path

import pytest


@pytest.fixture()
def main_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "ntfy-fax-notifications-v0.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("APP_BASE_URL", "https://kaos.test")
    monkeypatch.setenv("NTFY_ENABLED", "1")
    monkeypatch.setenv("NTFY_BASE_URL", "https://ntfy.example.local")
    monkeypatch.setenv("NTFY_TOPIC", "family-fax-test")
    monkeypatch.setenv("PUSHOVER_ENABLED", "0")
    monkeypatch.setenv("PUSHOVER_EMERGENCY_ENABLED", "0")
    monkeypatch.setenv("DEFAULT_SNOOZE_MINUTES", "10")

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


def test_fax_notifications_are_sent_to_ntfy_on_receive(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []

    def fake_send_ntfy(*, title: str, message: str, topic: str, url: str | None = None):
        calls.append({"title": title, "message": message, "topic": topic, "url": url})
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.ntfy_client.send_ntfy", fake_send_ntfy)
    # refresh module state so the ReminderService uses patched callable
    main_module.reminder_service.ntfy_client = fake_send_ntfy

    result = main_module.notify_fax_received(
        {
            "fax_id": "fax-ntfy-1",
            "event_id": "evt-1",
            "title": "Clinic report fax",
            "remote_number": "010",
        }
    )

    assert result["ok"] is True
    assert result["sent"] is True
    assert len(calls) == 1
    assert calls[0]["title"] == "Fax received"
    assert calls[0]["message"] == "Clinic report fax"
    assert calls[0]["topic"] == "family-fax-test"
    assert calls[0]["url"] == "https://kaos.test/fax"


def test_fax_send_failed_notifications_are_sent_to_ntfy(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []

    def fake_send_ntfy(*, title: str, message: str, topic: str, url: str | None = None):
        calls.append({"title": title, "message": message, "topic": topic, "url": url})
        return {"attempted": True, "succeeded": True, "reason": None}

    monkeypatch.setattr("app.integrations.ntfy_client.send_ntfy", fake_send_ntfy)
    main_module.reminder_service.ntfy_client = fake_send_ntfy

    result = main_module.notify_fax_send_failed(
        {
            "fax_id": "fax-ntfy-2",
            "event_id": "evt-2",
            "title": "Prescription fax",
            "target": "02-1234-5678",
            "error_message": "timeout",
        }
    )

    assert result["ok"] is True
    assert result["sent"] is True
    assert len(calls) == 1
    assert calls[0]["title"] == "Fax send failed"
    assert calls[0]["message"] == "Prescription fax"
    assert calls[0]["topic"] == "family-fax-test"
    assert calls[0]["url"] == "https://kaos.test/fax"
