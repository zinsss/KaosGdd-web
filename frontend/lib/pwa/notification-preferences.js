export const NOTIFICATION_MODE_PUSHOVER_PRIMARY = "pushover_primary";
export const NOTIFICATION_MODE_WEB_PUSH_ONLY = "web_push_only";
export const NOTIFICATION_MODE_PUSHOVER_ONLY = "pushover_only";
export const LEGACY_NOTIFICATION_MODE_HYBRID = "hybrid";
export const DEFAULT_NOTIFICATION_MODE = NOTIFICATION_MODE_PUSHOVER_PRIMARY;
export const DEFAULT_NOTIFICATION_MODES = [
  NOTIFICATION_MODE_PUSHOVER_PRIMARY,
  NOTIFICATION_MODE_WEB_PUSH_ONLY,
  NOTIFICATION_MODE_PUSHOVER_ONLY,
];
export const ACTIVE_NOTIFICATION_MODES = new Set(DEFAULT_NOTIFICATION_MODES);

export const NOTIFICATION_MODE_LABELS = {
  [NOTIFICATION_MODE_PUSHOVER_PRIMARY]: "Pushover primary",
  [NOTIFICATION_MODE_WEB_PUSH_ONLY]: "Web Push only",
  [NOTIFICATION_MODE_PUSHOVER_ONLY]: "Pushover only",
};

export const NOTIFICATION_MODE_DESCRIPTIONS = {
  [NOTIFICATION_MODE_PUSHOVER_PRIMARY]:
    "All notifications go to Pushover; fired reminders also use Web Push for KaosGdd actions.",
  [NOTIFICATION_MODE_WEB_PUSH_ONLY]: "All app notifications use Web Push.",
  [NOTIFICATION_MODE_PUSHOVER_ONLY]: "All notifications use Pushover.",
};

export function normalizeNotificationMode(mode) {
  if (mode === LEGACY_NOTIFICATION_MODE_HYBRID) return DEFAULT_NOTIFICATION_MODE;
  return ACTIVE_NOTIFICATION_MODES.has(mode) ? mode : DEFAULT_NOTIFICATION_MODE;
}

export function normalizeNotificationPreferencesPayload(data) {
  if (!data || typeof data !== "object") return data;
  const preferences = data.preferences
    ? { ...data.preferences, mode: normalizeNotificationMode(data.preferences.mode) }
    : data.preferences;
  const supportedModes = Array.isArray(data.supported_modes)
    ? data.supported_modes
        .map((mode) => normalizeNotificationMode(mode))
        .filter((mode, index, modes) => ACTIVE_NOTIFICATION_MODES.has(mode) && modes.indexOf(mode) === index)
    : data.supported_modes;
  return {
    ...data,
    preferences,
    supported_modes: supportedModes,
  };
}

export async function getNotificationPreferences() {
  const res = await fetch("/api/push/notification-preferences", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to load notification preferences");
  }
  return normalizeNotificationPreferencesPayload(data);
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
  return normalizeNotificationPreferencesPayload(data);
}
