import RemindersPageClient from "./RemindersPageClient";

const REMINDER_MODES = ["active", "fired", "removed"];

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
  const mode = REMINDER_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  const result = await getReminders(mode);

  return <RemindersPageClient initialMode={mode} items={result.items || []} />;
}