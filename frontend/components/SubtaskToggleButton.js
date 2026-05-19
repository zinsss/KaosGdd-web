"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI_STRINGS } from "../lib/strings";

export default function SubtaskToggleButton({
  taskId,
  subtaskId,
  isDone,
  disabled = false,
  stopPropagation = false,
  refreshOnResolved = true,
  onStarted,
  onResolved,
  onNotFound,
  onError,
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick(event) {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (isSubmitting || disabled) return;
    setIsSubmitting(true);
    onStarted?.(taskId, subtaskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        onNotFound?.(taskId, subtaskId, data);
        if (refreshOnResolved) router.refresh();
        return;
      }

      if (!res.ok || !data?.ok) {
        const message = (data && data.error) || UI_STRINGS.SUBTASK_TOGGLE_FAILED;
        if (onError) onError(message, taskId, subtaskId, data);
        else window.alert(message);
        return;
      }

      onResolved?.(taskId, subtaskId, data);
      if (refreshOnResolved) router.refresh();
    } catch {
      const message = UI_STRINGS.SUBTASK_TOGGLE_FAILED;
      if (onError) onError(message, taskId, subtaskId);
      else window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      className={"prefixToggleButton" + (isDone ? " isDone" : " isUndone")}
      onClick={onClick}
      disabled={isSubmitting || disabled}
      aria-label={isDone ? "Mark subtask not done" : "Mark subtask done"}
    >
      {isDone ? "✓" : "○"}
    </button>
  );
}
