// Minimal service worker: caches the app so it opens even with no internet.
const CACHE_NAME = 'focus-timer-v51';
const FILES_TO_CACHE = ['./timer.html', './manifest.json', './icon-192.png', './icon-512.png', './calendar-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate this new version immediately, don't wait
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache.addAll() lets the browser reuse a stale copy from its normal
      // HTTP cache. Fetching with {cache: 'reload'} forces a real network
      // request every time, so an update always gets truly fresh files.
      Promise.all(FILES_TO_CACHE.map((url) =>
        fetch(url, { cache: 'reload' }).then((response) => cache.put(url, response))
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// The app page is served network-first so a new version is picked up the very
// next time the app is opened online. Cache-first would keep serving the old
// page forever, since the server would never even be asked. Everything else
// (icons, manifest) is cache-first, as those change rarely and load faster.
const PAGE_TIMEOUT_MS = 5000;

function fetchPageFresh(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), PAGE_TIMEOUT_MS);
    // {cache: 'reload'} is essential: a plain fetch() would be answered by the
    // browser's own HTTP cache, which keeps serving the old page long after a
    // new one is published - the exact reason updates used to need a manual
    // "clear storage" to show up.
    fetch(request.url, { cache: 'reload', credentials: 'same-origin' }).then((response) => {
      clearTimeout(timer);
      if (!response || !response.ok) {
        reject(new Error('bad response'));
        return;
      }
      caches.open(CACHE_NAME).then((cache) => cache.put('./timer.html', response.clone()));
      resolve(response);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const isPage = request.mode === 'navigate' || request.destination === 'document';

  if (isPage) {
    // Offline, slow, or a server error all fall back to the cached copy.
    event.respondWith(
      fetchPageFresh(request)
        .catch(() => caches.match('./timer.html').then((cached) => cached || caches.match(request)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
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
