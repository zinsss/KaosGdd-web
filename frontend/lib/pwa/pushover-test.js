export async function sendPushoverTest() {
  const res = await fetch("/api/push/pushover-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || "Failed to send Pushover test");
  }
  if (!data.ok) {
    const reason = data?.reason ? ` (${data.reason})` : "";
    throw new Error(`Pushover test failed${reason}`);
  }
  return data;
}
