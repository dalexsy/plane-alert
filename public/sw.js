/* Plane Alert — Web Push worker (no FCM). */
/* global self, clients */
var DEFAULT_URL = 'https://planes.dryl.io/';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(Promise.resolve());
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = { title: 'Plane Alert', body: '', url: DEFAULT_URL, icon: '', image: '', tag: '' };
  try {
    if (event.data) {
      var parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.title === 'string' && parsed.title) payload.title = parsed.title;
        if (typeof parsed.body === 'string') payload.body = parsed.body;
        if (typeof parsed.url === 'string' && parsed.url) payload.url = parsed.url;
        if (typeof parsed.icon === 'string') payload.icon = parsed.icon;
        if (typeof parsed.image === 'string') payload.image = parsed.image;
        if (typeof parsed.tag === 'string') payload.tag = parsed.tag;
      }
    }
  } catch (_e) { /* ignore */ }

  var tag = payload.tag || payload.url || 'plane-alert';
  var options = {
    body: payload.body,
    tag: tag,
    renotify: false,
    data: { url: payload.url || DEFAULT_URL },
    actions: [{ action: 'open-map', title: 'View on Map' }],
  };
  if (payload.icon) options.icon = payload.icon;
  if (payload.image) options.image = payload.image;

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

function targetUrlFromNotification(notification) {
  var data = (notification && notification.data) || {};
  if (typeof data.url === 'string' && data.url) return data.url;
  return DEFAULT_URL;
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = targetUrlFromNotification(event.notification);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (!client || typeof client.url !== 'string') continue;
        if (client.url.indexOf(self.location.origin) !== 0) continue;
        if (typeof client.focus === 'function') {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return Promise.resolve();
    }),
  );
});
