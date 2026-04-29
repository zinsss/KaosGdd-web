const SW_CACHE = "kaosgdd-app-shell-v0";
const APP_SHELL_PATHS = ["/", "/tasks", "/reminders", "/events", "/journals", "/notes", "/files"];
const BADGE_DEBUG_PREFIX = "[sw:badge]";

const canUseBadgeApi = () => typeof self.navigator !== "undefined";

const tryUpdateBadge = async (hasAttention) => {
  const hasNavigator = canUseBadgeApi();
  const hasSetAppBadge = hasNavigator && "setAppBadge" in self.navigator;
  const hasClearAppBadge = hasNavigator && "clearAppBadge" in self.navigator;

  console.debug(
    `${BADGE_DEBUG_PREFIX} api=${hasSetAppBadge || hasClearAppBadge} attention=${hasAttention}`,
  );

  if (typeof hasAttention !== "boolean") return;

  try {
    if (hasAttention) {
      if (!hasSetAppBadge) {
        console.debug(`${BADGE_DEBUG_PREFIX} set skipped (unsupported)`);
        return;
      }
      await self.navigator.setAppBadge();
      console.debug(`${BADGE_DEBUG_PREFIX} set ok`);
      return;
    }

    if (!hasClearAppBadge) {
      console.debug(`${BADGE_DEBUG_PREFIX} clear skipped (unsupported)`);
      return;
    }
    await self.navigator.clearAppBadge();
    console.debug(`${BADGE_DEBUG_PREFIX} clear ok`);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    console.debug(`${BADGE_DEBUG_PREFIX} failed ${errorText}`);
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SW_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_PATHS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SW_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isDocument = event.request.mode === "navigate";
  if (!isDocument) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(SW_CACHE);
      return (await cache.match(requestUrl.pathname)) || (await cache.match("/tasks"));
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  const title = payload.title || "KaosGdd";
  const body = payload.body || "New reminder";
  const url = payload.url || "/reminders?mode=fired";
  const hasAppAttention =
    typeof payload.has_app_attention === "boolean" ? payload.has_app_attention : null;
  const badgeCount = Number.isFinite(payload.badge_count) ? Number(payload.badge_count) : null;

  event.waitUntil(
    (async () => {
      if (hasAppAttention !== null) {
        await tryUpdateBadge(hasAppAttention);
      } else if (badgeCount !== null) {
        await tryUpdateBadge(badgeCount > 0);
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const nextUrl = event.notification.data?.url || "/reminders?mode=fired";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          client.focus();
          client.navigate(nextUrl);
          return;
        }
      }
      return self.clients.openWindow(nextUrl);
    }),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "KAOSGDD_DEBUG_BADGE") return;
  if (self.location.hostname !== "localhost") return;

  if (data.action === "set") {
    void tryUpdateBadge(true);
    return;
  }
  if (data.action === "clear") {
    void tryUpdateBadge(false);
  }
});
