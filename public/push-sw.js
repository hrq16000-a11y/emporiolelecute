/* Service worker exclusivo para Web Push (não faz cache de app shell). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Empório LeleCute", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Empório LeleCute";
  const options = {
    body: data.body || "Seu pedido foi atualizado.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "emporio-lelecute",
    renotify: true,
    data: { url: data.url || "/rastrear" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/rastrear";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
