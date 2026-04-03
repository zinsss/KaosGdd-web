"use client";

import { useEffect, useRef, useState } from "react";
import { UI_STRINGS } from "../lib/strings";

function toLocalInputValue(value) {
  if (!value) return "";
  const raw = String(value).trim();

  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;

  return raw;
}

export default function TaskEditForm({ task }) {
  const [title, setTitle] = useState(task.title || "");
  const [dueAt, setDueAt] = useState(toLocalInputValue(task.due_at_display || task.due_at));
  const [memo, setMemo] = useState(task.memo || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const memoRef = useRef(null);

  useEffect(() => {
    if (!memoRef.current) return;
    memoRef.current.style.height = "0px";
    memoRef.current.style.height = memoRef.current.scrollHeight + "px";
  }, [memo]);

  async function onSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks/" + task.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          due_at: dueAt.trim() || null,
          memo: memo.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        setError((data && data.error) || "Save failed.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Save failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel">
      <div className="sectionTitle">{UI_STRINGS.EDIT_TASK}</div>

      <div className="fieldBlock">
        <label className="fieldLabel">{UI_STRINGS.TITLE}</label>
        <input
          className="textInput"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="fieldBlock">
        <label className="fieldLabel">{UI_STRINGS.DUE}</label>
        <input
          className="textInput"
          type="text"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          placeholder="yyyy-mm-dd HH:MM (KST)"
          disabled={isSubmitting}
        />
      </div>

      <div className="fieldBlock">
        <label className="fieldLabel">{UI_STRINGS.MEMO}</label>
        <textarea
          ref={memoRef}
          className="textInput autoTextarea"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={1}
          disabled={isSubmitting}
        />
      </div>

      <div className="actionRow compactActionRow">
        <button className="button compactButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
        </button>
      </div>

      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}