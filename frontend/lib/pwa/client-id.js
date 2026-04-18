const CLIENT_ID_STORAGE_KEY = "kaosgdd_pwa_client_id";

function makeClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `kaos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getClientId() {
  if (typeof window === "undefined") return "server";

  let value = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (value) return value;

  value = makeClientId();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, value);
  return value;
}
