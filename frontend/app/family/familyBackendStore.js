export async function fetchFamilyRecord(recordKey, fallbackValue = null) {
  try {
    const response = await fetch(`/api/family/records/${encodeURIComponent(recordKey)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("family record fetch failed");
    const parsed = await response.json();
    return parsed?.payload ?? fallbackValue;
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
    return response.ok;
  } catch {
    return false;
  }
}
