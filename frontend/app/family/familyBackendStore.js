export async function fetchFamilyRecord(recordKey, fallbackValue = null) {
  try {
    const response = await fetch(`/api/family/records/${encodeURIComponent(recordKey)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("family record fetch failed");
    const parsed = await response.json();
    if (parsed?.payload === null || typeof parsed?.payload === "undefined") {
      if (fallbackValue !== null && typeof fallbackValue !== "undefined") {
        persistFamilyRecord(recordKey, fallbackValue);
      }
      return fallbackValue;
    }
    return parsed.payload;
  } catch {
    return fallbackValue;
  }
}

export async function persistFamilyRecord(recordKey, payload) {
  try {
    const response = await fetch(`/api/family/records/${encodeURIComponent(recordKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    if (!response.ok) return false;
    const parsed = await response.json().catch(() => null);
    return parsed && Object.prototype.hasOwnProperty.call(parsed, "payload") ? parsed.payload : true;
  } catch {
    return false;
  }
}
