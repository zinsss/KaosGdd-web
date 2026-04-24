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

function isPushSupported() {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext
  );
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

async function fetchBackendPushStatus(endpoint) {
  const params = new URLSearchParams({ client_id: getClientId() });
  if (endpoint) {
    params.set("endpoint", endpoint);
  }
  const res = await fetch(`/api/push/status?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to load backend push status");
  }
  return data;
}

export async function getPushStatus() {
  if (!isPushSupported()) {
    return { state: "unsupported", message: "Push not supported on this device/browser" };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return { state: "blocked", message: "Notifications blocked in browser settings" };
  }

  const registration = await getRegistration();
  if (!registration) {
    return { state: "unsupported", message: "Push not supported on this device/browser" };
  }

  const subscription = await registration.pushManager.getSubscription();
  if (permission === "granted" && subscription) {
    try {
      const backendStatus = await fetchBackendPushStatus(subscription.endpoint);
      if (!backendStatus.backend_subscription_saved || backendStatus.endpoint_match === false) {
        return {
          state: "enabled",
          message: "Notifications enabled locally, but backend subscription is missing",
          backendConnected: false,
          lastTest: backendStatus.last_test || null,
        };
      }
      if (backendStatus.last_test && backendStatus.last_test.ok === false) {
        return {
          state: "enabled",
          message: "Notifications enabled, but last backend test push failed",
          backendConnected: true,
          lastTest: backendStatus.last_test,
        };
      }
      return {
        state: "enabled",
        message: "Notifications enabled and backend connected",
        backendConnected: true,
        lastTest: backendStatus.last_test || null,
      };
    } catch {
      return { state: "enabled", message: "Notifications enabled (backend status unavailable)" };
    }
  }

  return { state: "disabled", message: "Notifications are off" };
}

export async function subscribeToPush(registration) {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) {
    throw new Error("Notifications are not supported on this browser");
  }

  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  return ensurePushSubscription(registration);
}

export async function bootstrapPushSubscription() {
  if (!isPushSupported()) return;

  try {
    const registration = await getRegistration();
    if (!registration || Notification.permission !== "granted") return;

    await ensurePushSubscription(registration);
  } catch {
    // best-effort bootstrap only
  }
}

export async function unsubscribeFromPush(registration) {
  const knownEndpoint = getStoredEndpoint();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    if (knownEndpoint) {
      await deleteSubscriptionEndpoint(knownEndpoint);
    }
    setStoredEndpoint("");
    return;
  }

  await deleteSubscriptionEndpoint(subscription.endpoint);
  if (knownEndpoint && knownEndpoint !== subscription.endpoint) {
    await deleteSubscriptionEndpoint(knownEndpoint);
  }

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
  if (!res.ok || !data) {
    throw new Error(data?.error || "Failed to send test push");
  }
  if (!data.ok) {
    const firstError = data?.errors?.[0];
    const suffix = firstError?.summary ? ` (${firstError.summary})` : "";
    const removedText = data?.removed ? " Subscription was removed after failed delivery." : "";
    throw new Error(`Push send failed on backend${suffix}.${removedText}`.trim());
  }
  return data;
}
