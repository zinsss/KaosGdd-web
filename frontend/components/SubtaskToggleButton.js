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
      className={
        "button subtaskToggleButton compactFlatButton " +
        (isDone ? "subtaskToggleButtonDone" : "subtaskToggleButtonUndone")
      }
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isDone ? "✓" : "○"}
    </button>
  );
}
