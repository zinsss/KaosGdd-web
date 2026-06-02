"use client";

import { useEffect, useState } from "react";

import { UI_STRINGS } from "../../lib/strings";
import {
  NOTIFICATION_MODE_DESCRIPTIONS,
  NOTIFICATION_MODE_LABELS,
  getNotificationPreferences,
  saveNotificationMode,
} from "../../lib/pwa/notification-preferences";
import { getPushStatus, sendTestPush, subscribeToPush, unsubscribeFromPush } from "../../lib/pwa/push";
import { sendPushoverTest } from "../../lib/pwa/pushover-test";

export default function PushControls() {
  const [status, setStatus] = useState({ state: "loading", message: "Checking notification status…" });
  const [preferences, setPreferences] = useState({ mode: "hybrid" });
  const [supportedModes, setSupportedModes] = useState(["hybrid", "pushover_only", "web_push_only"]);
  const [stateText, setStateText] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    try {
      const [next, preferenceData] = await Promise.all([getPushStatus(), getNotificationPreferences()]);
      setStatus(next);
      setPreferences(preferenceData.preferences || { mode: "hybrid" });
      setSupportedModes(preferenceData.supported_modes || ["hybrid", "pushover_only", "web_push_only"]);
    } catch {
      setStatus({ state: "unsupported", message: "Push not supported on this device/browser" });
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, []);

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setStateText("");

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported on this browser");
      }

      const registration = await navigator.serviceWorker.ready;
      await action(registration);
      await refreshStatus();
    } catch (error) {
      setStateText(error instanceof Error ? error.message : UI_STRINGS.ACTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function runStandalone(action, successMessage = "") {
    if (busy) return;
    setBusy(true);
    setStateText("");

    try {
      await action();
      if (successMessage) {
        setStateText(successMessage);
      }
    } catch (error) {
      setStateText(error instanceof Error ? error.message : UI_STRINGS.ACTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function updateMode(mode) {
    if (busy || mode === preferences.mode) return;
    setBusy(true);
    setStateText("");

    try {
      const data = await saveNotificationMode(mode);
      setPreferences(data.preferences || { mode });
      setSupportedModes(data.supported_modes || supportedModes);
      setStateText("Notification preference saved.");
      await refreshStatus();
    } catch (error) {
      setStateText(error instanceof Error ? error.message : UI_STRINGS.ACTION_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="sectionTitle">Notifications</div>
      <div className="subline">Delivery mode: {NOTIFICATION_MODE_LABELS[preferences.mode] || preferences.mode}</div>
      <div className="actionRow">
        {supportedModes.map((mode) => (
          <button
            key={mode}
            className={
              "button compactButton " +
              (preferences.mode === mode ? "buttonToneSave" : "buttonToneNeutral")
            }
            disabled={busy}
            onClick={() => updateMode(mode)}
            type="button"
          >
            {NOTIFICATION_MODE_LABELS[mode] || mode}
          </button>
        ))}
      </div>
      <div className="subline">{NOTIFICATION_MODE_DESCRIPTIONS[preferences.mode] || ""}</div>

      <div className="subline">{status.message}</div>
      {status.localStatus ? <div className="subline">{status.localStatus}</div> : null}
      {status.backendStatus ? <div className="subline">{status.backendStatus}</div> : null}
      {status.deliveryStatus ? <div className="subline">{status.deliveryStatus}</div> : null}

      {status.state === "disabled" ? (
        <div className="actionRow">
          <button className="button compactButton buttonToneSave" disabled={busy} onClick={() => run(subscribeToPush)}>
            Enable notifications
          </button>
        </div>
      ) : null}

      {status.state === "enabled" ? (
        <div className="actionRow">
          <button className="button compactButton buttonToneDanger" disabled={busy} onClick={() => run(unsubscribeFromPush)}>
            Disable
          </button>
          <button className="button compactButton buttonToneSave" disabled={busy} onClick={() => run(() => sendTestPush())}>
            Send Test
          </button>
          <button className="button compactButton buttonToneNeutral" disabled={busy} onClick={() => run(() => Promise.resolve())}>
            Refresh status
          </button>
        </div>
      ) : null}

      <div className="actionRow">
        <button
          className="button compactButton buttonToneSave"
          disabled={busy}
          onClick={() => runStandalone(sendPushoverTest, UI_STRINGS.PUSHOVER_TEST_SENT)}
        >
          {UI_STRINGS.PUSHOVER_TEST_BUTTON}
        </button>
      </div>

      {stateText ? <div className="subline">{stateText}</div> : null}
    </section>
  );
}
