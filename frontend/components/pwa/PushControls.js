"use client";

import { useState } from "react";

import { subscribeToPush, sendTestPush, unsubscribeFromPush } from "../../lib/pwa/push";

export default function PushControls() {
  const [stateText, setStateText] = useState("");
  const [busy, setBusy] = useState(false);

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
      setStateText("Done.");
    } catch (error) {
      setStateText(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="sectionTitle">PWA</div>
      <div className="actionRow">
        <button className="button compactButton" disabled={busy} onClick={() => run(subscribeToPush)}>
          Enable Push
        </button>
        <button className="button compactButton" disabled={busy} onClick={() => run(unsubscribeFromPush)}>
          Disable Push
        </button>
        <button className="button compactButton" disabled={busy} onClick={() => run(() => sendTestPush())}>
          Test Push
        </button>
      </div>
      {stateText ? <div className="subline">{stateText}</div> : null}
    </section>
  );
}
