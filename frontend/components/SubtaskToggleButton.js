"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubtaskToggleButton({ taskId, subtaskId, isDone }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        router.refresh();
        return;
      }

      if (!res.ok || !data?.ok) {
        window.alert((data && data.error) || "Subtask toggle failed.");
        return;
      }

      router.refresh();
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
