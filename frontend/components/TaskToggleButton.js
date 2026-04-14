"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI_STRINGS } from "../lib/strings";

export default function TaskToggleButton({
  taskId,
  isDone,
  compact = false,
  prefixOnly = false,
  onResolved,
  onNotFound,
  onError,
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/tasks/" + taskId + "/toggle", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        onNotFound?.(taskId, data);
        router.refresh();
        return;
      }

      if (!res.ok || !data?.ok) {
        const message = (data && data.error) || "Task toggle failed.";
        if (onError) onError(message);
        else window.alert(message);
        return;
      }

      onResolved?.(taskId, data);
      router.refresh();
    } catch {
      const message = "Task toggle failed.";
      if (onError) onError(message);
      else window.alert(message);
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
