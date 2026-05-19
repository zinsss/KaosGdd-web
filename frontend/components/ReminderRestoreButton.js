"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI_STRINGS } from "../lib/strings";

export default function ReminderRestoreButton({ reminderId }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/reminders/" + reminderId + "/restore", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        window.alert((data && data.error) || UI_STRINGS.REMINDER_RESTORE_FAILED);
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
      className="button compactButton buttonToneSave"
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isSubmitting ? UI_STRINGS.ELLIPSIS : UI_STRINGS.RESTORE}
    </button>
  );
}
