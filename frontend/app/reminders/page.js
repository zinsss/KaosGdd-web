import { Suspense } from "react";
import RemindersPageClient from "./RemindersPageClient";

const REMINDER_MODES = ["active", "fired", "removed"];

function firstSearchParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function getReminders(mode) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const suffix = mode && mode !== "active" ? `?mode=${encodeURIComponent(mode)}` : "";
  try {
    const res = await fetch(base + "/reminders" + suffix, { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function RemindersPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const modeParam = firstSearchParam(resolvedSearchParams?.mode);
  const reminderIdParam = firstSearchParam(resolvedSearchParams?.reminder_id);
  const mode = REMINDER_MODES.includes(modeParam) ? modeParam : "active";
  const result = await getReminders(mode);
  const initialExpandedReminderId = reminderIdParam ? String(reminderIdParam) : null;

  return (
    <Suspense fallback={null}>
      <RemindersPageClient
        initialMode={mode}
        items={result.items || []}
        initialExpandedReminderId={initialExpandedReminderId}
      />
    </Suspense>
  );
}
