const SW_CACHE = "kaosgdd-app-shell-v1";
const APP_SHELL_PATHS = ["/", "/scribble", "/tasks", "/reminders", "/events", "/journals", "/notes", "/files"];

const normalizeBadgeCount = (count) => {
  const numericCount = Number(count);
  return Number.isFinite(numericCount) ? Math.max(0, numericCount) : 0;
};

const tryUpdateBadge = async (count) => {
  const safeCount = normalizeBadgeCount(count);

  try {
    if (safeCount > 0 && "setAppBadge" in self.registration) {
      await self.registration.setAppBadge(safeCount);
      return;
    }

    if (safeCount <= 0 && "clearAppBadge" in self.registration) {
      await self.registration.clearAppBadge();
    }
  } catch {
    // App badging is best-effort and unsupported on some browsers/PWA contexts.
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
      return (await cache.match(requestUrl.pathname)) || (await cache.match("/"));
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
  const numericBadgeCount = Number(payload.badge_count);
  const badgeCount = Number.isFinite(numericBadgeCount) ? numericBadgeCount : null;

  event.waitUntil(
    (async () => {
      if (badgeCount !== null) {
        await tryUpdateBadge(badgeCount);
      } else if (hasAppAttention !== null) {
        await tryUpdateBadge(hasAppAttention ? 1 : 0);
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        icon: "/icon-192.png",
        badge: "/icon-192.png",
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
