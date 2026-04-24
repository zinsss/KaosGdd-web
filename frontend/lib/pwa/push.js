import { getClientId } from "./client-id";

const PUSH_ENDPOINT_STORAGE_KEY = "kaosgdd_pwa_push_endpoint";

function decodeBase64Url(input) {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function getStoredEndpoint() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PUSH_ENDPOINT_STORAGE_KEY) || "";
}

function setStoredEndpoint(endpoint) {
  if (typeof window === "undefined") return;
  if (!endpoint) {
    window.localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, endpoint);
}

async function saveSubscription(subscription) {
  const subscriptionJson = subscription.toJSON ? subscription.toJSON() : subscription;

  const saveRes = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), subscription: subscriptionJson }),
  });
  const saveData = await saveRes.json().catch(() => null);
  if (!saveRes.ok || !saveData?.ok) {
    throw new Error(saveData?.error || "Unable to save push subscription");
  }
}

async function deleteSubscriptionEndpoint(endpoint) {
  if (!endpoint) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), endpoint }),
  }).catch(() => undefined);
}

async function ensurePushSubscription(registration) {
  const vapidRes = await fetch("/api/push/subscriptions");
  const vapidData = await vapidRes.json();
  if (!vapidRes.ok || !vapidData?.ok || !vapidData?.public_key) {
    throw new Error(vapidData?.error || "Push key unavailable");
  }

  const knownEndpoint = getStoredEndpoint();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(vapidData.public_key),
    });
  }

  if (knownEndpoint && knownEndpoint !== subscription.endpoint) {
    await deleteSubscriptionEndpoint(knownEndpoint);
  }

  await saveSubscription(subscription);
  setStoredEndpoint(subscription.endpoint);

  return subscription;
}

export async function subscribeToPush(registration) {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) {
    throw new Error("Notifications are not supported on this browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  return ensurePushSubscription(registration);
}

export async function bootstrapPushSubscription() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  if (!window.isSecureContext) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission().catch(() => "default");
    if (permission !== "granted") return;

    await ensurePushSubscription(registration);
  } catch {
    // best-effort bootstrap only
  }
}

export async function unsubscribeFromPush(registration) {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    setStoredEndpoint("");
    return;
  }

  await deleteSubscriptionEndpoint(subscription.endpoint);

  await subscription.unsubscribe();
  setStoredEndpoint("");
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
