export async function setBadgeCount(count) {
  if (typeof navigator === "undefined") return;
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

  if (safeCount > 0 && "setAppBadge" in navigator) {
    await navigator.setAppBadge(safeCount).catch(() => undefined);
    return;
  }

  if (safeCount === 0 && "clearAppBadge" in navigator) {
    await navigator.clearAppBadge().catch(() => undefined);
  }
}
