const SW_CACHE = "kaosgdd-app-shell-v0";
const APP_SHELL_PATHS = ["/", "/tasks", "/reminders", "/events", "/journals", "/notes", "/files"];

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
  const badgeCount = Number.isFinite(payload.badge_count) ? Number(payload.badge_count) : null;

  event.waitUntil(
    (async () => {
      if (badgeCount !== null) {
        if (badgeCount > 0 && "setAppBadge" in self.registration) {
          await self.registration.setAppBadge(badgeCount).catch(() => undefined);
        }
        if (badgeCount <= 0 && "clearAppBadge" in self.registration) {
          await self.registration.clearAppBadge().catch(() => undefined);
        }
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
