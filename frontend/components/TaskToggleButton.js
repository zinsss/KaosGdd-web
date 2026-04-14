"use client";

import { useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function TaskToggleButton({ taskId, isDone, compact = false, prefixOnly = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await fetch("/api/tasks/" + taskId + "/toggle", {
        method: "POST",
      });
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (prefixOnly) {
    return (
      <button
        type="button"
        className={"prefixToggleButton" + (isDone ? " isDone" : " isUndone")}
        onClick={onClick}
        disabled={isSubmitting}
        aria-label={isDone ? UI_STRINGS.UNDO : UI_STRINGS.DONE}
      >
        {isDone ? "✓" : "○"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={
        "button taskToggleButton" +
        (compact ? " compactInlineButton compactFlatButton" : "") +
        (compact ? (isDone ? " compactFlatButtonUndo" : " compactFlatButtonDone") : "")
      }
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isDone ? UI_STRINGS.UNDO : UI_STRINGS.DONE}
    </button>
  );
}
