export const NOTIFICATION_MODE_LABELS = {
  web_push_only: "Web Push only",
  pushover_only: "Pushover only",
  hybrid: "Hybrid",
};

export const NOTIFICATION_MODE_DESCRIPTIONS = {
  web_push_only: "All app notifications use Web Push.",
  pushover_only: "All app notifications use Pushover emergency.",
  hybrid: "Normal reminders use Web Push; urgent and system notifications use Pushover emergency.",
};

export async function getNotificationPreferences() {
  const res = await fetch("/api/push/notification-preferences", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to load notification preferences");
  }
  return data;
}

export async function saveNotificationMode(mode) {
  const res = await fetch("/api/push/notification-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to save notification preferences");
  }
  return data;
}
