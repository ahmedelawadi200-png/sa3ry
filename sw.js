const CACHE_NAME = 'sa3ry-v1.2';
const STATIC_ASSETS = [
  '/sa3ry/',
  '/sa3ry/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
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
  // Cache static assets
  if (url.includes('googleapis.com') || url.includes('cdnjs.cloudflare.com') || url.includes('fontawesome')) {
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
  // For API calls: network first
  if (url.includes('firebase') || url.includes('firestore') || url.includes('cloudinary')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  // For page requests: cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request);
    })
  );
});

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'سعري', body: 'إشعار جديد' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'سعري', {
      body: data.body || '',
      icon: '/sa3ry/icon-192.png',
      badge: '/sa3ry/icon-96.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/sa3ry/'));
});
