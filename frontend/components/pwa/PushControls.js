"use client";

import { useEffect, useState } from "react";

import { getPushStatus, sendTestPush, subscribeToPush, unsubscribeFromPush } from "../../lib/pwa/push";

export default function PushControls() {
  const [status, setStatus] = useState({ state: "loading", message: "Checking notification status…" });
  const [stateText, setStateText] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    try {
      const next = await getPushStatus();
      setStatus(next);
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
      setStateText(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="sectionTitle">Notifications</div>
      <div className="subline">{status.message}</div>

      {status.state === "disabled" ? (
        <div className="actionRow">
          <button className="button compactButton" disabled={busy} onClick={() => run(subscribeToPush)}>
            Enable notifications
          </button>
        </div>
      ) : null}

      {status.state === "enabled" ? (
        <div className="actionRow">
          <button className="button compactButton" disabled={busy} onClick={() => run(unsubscribeFromPush)}>
            Disable
          </button>
          <button className="button compactButton" disabled={busy} onClick={() => run(() => sendTestPush())}>
            Send test notification
          </button>
        </div>
      ) : null}

      {stateText ? <div className="subline">{stateText}</div> : null}
    </section>
  );
}
