"use client";

import { useState } from "react";

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
        body: JSON.stringify({ remind_at: cleanRemindAt })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to add reminder.");
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
    <form onSubmit={onSubmit} className="panel">
      <div className="sectionTitle">Add reminder</div>
      <div className="formRow">
        <input
          className="textInput"
          type="text"
          value={remindAt}
          onChange={(event) => setRemindAt(event.target.value)}
          placeholder="2026-04-02T21:30:00+09:00"
          disabled={isSubmitting}
        />
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add"}
        </button>
      </div>
      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}