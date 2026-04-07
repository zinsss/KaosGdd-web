"use client";

import { useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function AddReminderForm({ taskId }) {
  const [remindAt, setRemindAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const cleanRemindAt = remindAt.trim();

    if (!cleanRemindAt) {
      setError("remind_at is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks/" + taskId + "/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remind_at: cleanRemindAt }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        setError((data && data.error) || "Failed to add reminder.");
        return;
      }

      setRemindAt("");
      window.location.reload();
    } catch {
      setError("Failed to add reminder.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="formRow">
        <input
          className="textInput"
          type="text"
          value={remindAt}
          onChange={(event) => setRemindAt(event.target.value)}
          placeholder="yyyy-mm-dd HH:MM (KST)"
          disabled={isSubmitting}
          spellCheck={false}
        />
        <button className="button compactButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? UI_STRINGS.ADDING : UI_STRINGS.ADD}
        </button>
      </div>
      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}