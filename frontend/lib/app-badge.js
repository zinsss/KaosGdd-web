export async function updateAppBadge(count) {
  const numericCount = Number(count);
  const safeCount = Number.isFinite(numericCount) ? Math.max(0, numericCount) : 0;

  try {
    if (safeCount > 0 && typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      await navigator.setAppBadge(safeCount);
      return;
    }

    if (safeCount <= 0 && typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch {
    // App badging is best-effort and unsupported on some browsers/PWA contexts.
  }
}
