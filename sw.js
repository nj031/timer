// Minimal service worker: caches the app so it opens even with no internet.
const CACHE_NAME = 'focus-timer-v6';
const FILES_TO_CACHE = ['./timer.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate this new version immediately, don't wait
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Handles taps on the notification itself, or its action buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (event.action === 'pause') {
        // Tell the open app page to pause the timer
        clientList.forEach((client) => client.postMessage({ type: 'pause-timer' }));
      }
      // Focus the existing app window if one is open, otherwise open it
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('./timer.html');
    })
  );
});
