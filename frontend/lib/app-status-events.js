export const KAOSGDD_STATUS_CHANGED_EVENT = "kaosgdd:status-changed";

export function dispatchAppStatusChanged(detail = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(KAOSGDD_STATUS_CHANGED_EVENT, { detail }));
}
