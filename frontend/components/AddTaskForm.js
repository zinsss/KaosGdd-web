"use client";

import { useState } from "react";

export default function AddTaskForm() {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to create task.");
        return;
      }

      setTitle("");
      window.location.reload();
    } catch {
      setError("Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel">
      <div className="sectionTitle">Add task</div>
      <div className="formRow">
        <input
          className="textInput"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="- new task"
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