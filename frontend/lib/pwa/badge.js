export async function setBadgeCount(count) {
  if (typeof navigator === "undefined") return;
  const hasAttention = typeof count === "boolean" ? count : Number.isFinite(count) && count > 0;

  if (hasAttention && "setAppBadge" in navigator) {
    await navigator.setAppBadge().catch(() => undefined);
    return;
  }

  if (!hasAttention && "clearAppBadge" in navigator) {
    await navigator.clearAppBadge().catch(() => undefined);
  }
}
