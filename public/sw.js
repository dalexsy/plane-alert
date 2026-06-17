importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: "AIzaSyCaMOUDaRPIFmCjHTiIOiFtMxdR3lWMDUw",
  authDomain: "plane-alert-800ff.firebaseapp.com",
  projectId: "plane-alert-800ff",
  storageBucket: "plane-alert-800ff.firebasestorage.app",
  messagingSenderId: "698615469333",
  appId: "1:698615469333:web:16aa74b0ae76832410451c",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Minimal service worker — push notifications only; do not cache the SPA shell.
// Caching / and /index.html caused white screens after the daily noon refresh.
const CACHE_NAME = "plane-alert-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept navigations or the app shell — always hit the network.
  if (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html"
  ) {
    return;
  }
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || "Plane Alert";
  const options = {
    body: notification.body,
    icon: notification.icon || "assets/favicon/military/favicon.ico",
    badge: notification.badge || "assets/favicon/military/favicon.ico",
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.link || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const matchingClient = clientsArr.find((client) =>
          client.url.includes(targetUrl)
        );
        if (matchingClient) {
          matchingClient.focus();
          return matchingClient.navigate(targetUrl);
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
