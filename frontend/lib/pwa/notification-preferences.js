export const NOTIFICATION_MODE_WEB_PUSH_ONLY = "web_push_only";
export const NOTIFICATION_MODE_PUSHOVER_ONLY = "pushover_only";
export const NOTIFICATION_MODE_HYBRID = "hybrid";
export const DEFAULT_NOTIFICATION_MODE = NOTIFICATION_MODE_HYBRID;
export const DEFAULT_NOTIFICATION_MODES = [
  NOTIFICATION_MODE_HYBRID,
  NOTIFICATION_MODE_PUSHOVER_ONLY,
  NOTIFICATION_MODE_WEB_PUSH_ONLY,
];

export const NOTIFICATION_MODE_LABELS = {
  [NOTIFICATION_MODE_WEB_PUSH_ONLY]: "Web Push only",
  [NOTIFICATION_MODE_PUSHOVER_ONLY]: "Pushover only",
  [NOTIFICATION_MODE_HYBRID]: "Hybrid",
};

export const NOTIFICATION_MODE_DESCRIPTIONS = {
  [NOTIFICATION_MODE_WEB_PUSH_ONLY]: "All app notifications use Web Push.",
  [NOTIFICATION_MODE_PUSHOVER_ONLY]: "All app notifications use Pushover emergency.",
  [NOTIFICATION_MODE_HYBRID]:
    "Normal reminders use Web Push; urgent and system notifications use Pushover emergency.",
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
