"use client";

import { useState } from "react";

import { UI_STRINGS } from "../lib/strings";

export default function AddTaskForm() {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(UI_STRINGS.TITLE_REQUIRED_UI);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || UI_STRINGS.FAILED_CREATE_TASK);
        return;
      }

      setTitle("");
      window.location.reload();
    } catch {
      setError(UI_STRINGS.FAILED_CREATE_TASK);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel">
      <div className="sectionTitle">{UI_STRINGS.ADD_TASK}</div>
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
          {isSubmitting ? UI_STRINGS.ADDING : UI_STRINGS.ADD}
        </button>
      </div>
      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}
