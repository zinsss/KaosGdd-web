"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        window.alert((data && data.error) || "Reminder restore failed.");
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
      {isSubmitting ? "..." : "Restore"}
    </button>
  );
}