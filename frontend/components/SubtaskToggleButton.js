"use client";

import { useState } from "react";

export default function SubtaskToggleButton({ taskId, subtaskId, isDone }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
        method: "POST",
      });
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      className={"prefixToggleButton" + (isDone ? " isDone" : " isUndone")}
      onClick={onClick}
      disabled={isSubmitting}
      aria-label={isDone ? "Mark subtask not done" : "Mark subtask done"}
    >
      {isDone ? "✓" : "○"}
    </button>
  );
}
