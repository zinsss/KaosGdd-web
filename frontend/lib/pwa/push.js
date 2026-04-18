import { getClientId } from "./client-id";

function decodeBase64Url(input) {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function subscribeToPush(registration) {
  const vapidRes = await fetch("/api/push/subscriptions");
  const vapidData = await vapidRes.json();
  if (!vapidRes.ok || !vapidData?.ok || !vapidData?.public_key) {
    throw new Error(vapidData?.error || "Push key unavailable");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidData.public_key),
  });

  const saveRes = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), subscription }),
  });
  const saveData = await saveRes.json().catch(() => null);
  if (!saveRes.ok || !saveData?.ok) {
    throw new Error(saveData?.error || "Unable to save push subscription");
  }

  return subscription;
}

export async function unsubscribeFromPush(registration) {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

export async function sendTestPush() {
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId() }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Failed to send test push");
  }
}
