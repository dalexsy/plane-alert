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

// Minimal service worker focused on runtime caching of fetched assets
const CACHE_NAME = "plane-alert-v2";
const PRECACHE_URLS = ["/", "/index.html", "/assets/favicon/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        const shouldCache =
          response.status === 200 && response.type === "basic";

        if (shouldCache) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) {
            return fallback;
          }
        }

        return Response.error();
      }
    })()
  );
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
