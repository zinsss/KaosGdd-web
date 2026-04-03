"use client";

import { useEffect, useRef, useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function TaskRawEditor({ taskId, initialRaw }) {
  const [raw, setRaw] = useState(initialRaw || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [raw]);

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks/" + taskId + "/raw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
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
      <div className="sectionTitle">{UI_STRINGS.RAW_EDIT}</div>

      <textarea
        ref={textareaRef}
        className="textInput autoTextarea rawEditor"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        rows={3}
        spellCheck={false}
      />

      <div className="actionRow compactActionRow">
        <button className="button compactButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
        </button>
      </div>

      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}