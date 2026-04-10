"use client";

import { useState } from "react";

export default function TaskRestoreButton({ taskId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/tasks/" + taskId + "/restore", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        window.alert((data && data.error) || "Task restore failed.");
        return;
      }

      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      className="button compactButton"
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isSubmitting ? "..." : "Restore"}
    </button>
  );
}