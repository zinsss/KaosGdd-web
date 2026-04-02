"use client";

import { useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function ReminderActions({ reminderId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function post(url, body) {
    setIsSubmitting(true);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="actionRow">
      <button
        className="button"
        disabled={isSubmitting}
        onClick={() => post("/api/reminders/" + reminderId + "/ack")}
      >
        {UI_STRINGS.ACK}
      </button>

      <button
        className="button"
        disabled={isSubmitting}
        onClick={() => post("/api/reminders/" + reminderId + "/snooze", { minutes: 10 })}
      >
        {UI_STRINGS.SNOOZE_10M}
      </button>

      <button
        className="button"
        disabled={isSubmitting}
        onClick={() => post("/api/reminders/" + reminderId + "/cancel")}
      >
        {UI_STRINGS.CANCEL}
      </button>
    </div>
  );
}