"use client";

import { useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function ReminderActions({ reminderId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function post(url, body) {
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        setError((data && data.error) || "Action failed.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="actionRow compactActionRow">
        <button
          type="button"
          className="button compactButton"
          disabled={isSubmitting}
          onClick={() => post("/api/reminders/" + reminderId + "/ack")}
        >
          {UI_STRINGS.ACK}
        </button>

        <button
          type="button"
          className="button compactButton"
          disabled={isSubmitting}
          onClick={() => post("/api/reminders/" + reminderId + "/snooze", { minutes: 10 })}
        >
          {UI_STRINGS.SNOOZE_10M}
        </button>

        <button
          type="button"
          className="button compactButton"
          disabled={isSubmitting}
          onClick={() => post("/api/reminders/" + reminderId + "/cancel")}
        >
          {UI_STRINGS.CANCEL}
        </button>
      </div>

      {error ? <div className="errorText">{error}</div> : null}
    </>
  );
}