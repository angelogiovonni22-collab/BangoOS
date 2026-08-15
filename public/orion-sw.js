self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Orion reminder", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Orion reminder";
  const options = {
    body: payload.body || "",
    icon: "/bos-app-icon.svg",
    badge: "/bos-app-icon.svg",
    tag: payload.tag || "orion-reminder",
    renotify: true,
    data: {
      href: payload.href || "/mobile-entry",
      reminderId: payload.reminderId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/mobile-entry";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(href);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(href);
  })());
});
