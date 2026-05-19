"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI_STRINGS } from "../lib/strings";

export default function TaskRestoreButton({ taskId, onResolved, onNotFound, onError }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/tasks/" + taskId + "/restore", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);
      if (res.status === 404) {
        onNotFound?.(taskId, data);
        router.refresh();
        return;
      }

      if (!res.ok || !data?.ok) {
        const message = (data && data.error) || UI_STRINGS.TASK_RESTORE_FAILED;
        if (onError) onError(message);
        else window.alert(message);
        return;
      }

      onResolved?.(taskId, data);
      router.refresh();
    } catch {
      const message = UI_STRINGS.TASK_RESTORE_FAILED;
      if (onError) onError(message);
      else window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      className="button compactButton buttonToneSave"
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isSubmitting ? UI_STRINGS.ELLIPSIS : UI_STRINGS.RESTORE}
    </button>
  );
}
