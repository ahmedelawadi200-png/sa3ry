const CACHE_NAME = 'sa3ry-v2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Cache-first for static assets (fonts, icons, CSS)
  if (url.includes('googleapis.com') || url.includes('cdnjs.cloudflare.com') || url.includes('fontawesome') || url.includes('html5-qrcode')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // For Firebase/API calls: network first with offline fallback
  if (url.includes('firebase') || url.includes('firestore') || url.includes('identitytoolkit') || url.includes('cloudinary')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({error: 'offline', offline: true}), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // For app shell: cache first, fallback to network
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.json')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => {
          // Fallback to offline page if available
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Default: network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'سعري', body: 'إشعار جديد' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'سعري', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});

// Background sync for price alerts
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-price-alerts') {
    e.waitUntil(
      // Attempt to sync price alerts when back online
      Promise.resolve().then(() => {
        console.log('Background sync: price alerts');
      })
    );
  }
});
