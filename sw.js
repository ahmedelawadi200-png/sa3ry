const CACHE_NAME = 'sa3ry-v5.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './css/animations.css',
  './js/utils.js',
  './js/firebase.js',
  './js/auth.js',
  './js/products.js',
  './js/admin.js',
  './js/search.js',
  './js/notifications.js',
  './js/ui.js',
  './js/main.js',
  './404.html',
  './offline.html',
  './offline.html',
  './pages/about.html',
  './pages/contact.html',
  './pages/privacy.html',
  './pages/terms.html',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap'
  // NOTE: html5-qrcode intentionally NOT precached here - it's lazy-loaded
  // only when the QR scanner is opened (see startQRScanner() in search.js),
  // and gets cached via the CDN fetch-handler branch below the first time
  // that actually happens, not on every install.
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

  // BUGFIX: `Cache.put()` only ever accepts GET requests - calling it with
  // a POST/PUT/etc. throws "Request method 'X' is unsupported" and crashes
  // the fetch handler. Firestore's live-sync ("Listen"/"Write" channel)
  // requests are POST and go to a *.googleapis.com host, so the broad
  // `url.includes('googleapis.com')` check below was unintentionally
  // catching them and trying to cache them. Bailing out early for any
  // non-GET request fixes this at the source, regardless of which branch
  // below would have matched.
  if (e.request.method !== 'GET') {
    return;
  }

  // Cache-first for static assets (fonts, icons, CSS)
  // BUGFIX: narrowed from the overly broad `googleapis.com` (which also
  // matches Firestore's own API/sync domains) to the specific Google Fonts
  // host this branch actually intends to cache.
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || url.includes('cdnjs.cloudflare.com') || url.includes('html5-qrcode')) {
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

  // For app shell (JS/HTML/JSON): network-first, falling back to cache when
  // offline.
  // BUGFIX: this used to be cache-first, which meant once a file was cached
  // it was served from cache FOREVER and never re-checked against the
  // network - a code fix shipped to GitHub would silently never reach
  // returning visitors unless CACHE_NAME was manually bumped every single
  // time. Network-first means the latest deployed code is used whenever
  // there's a connection, while still working offline via the cache.
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.json')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(e.request).then(cached =>
          cached || caches.match('./index.html').then(shell => shell || caches.match('./offline.html'))
        );
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
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
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

// ==================== BACKGROUND SYNC FOR PRICE ALERTS ====================
// BUGFIX: previously this handler only logged a message to the console - it
// never actually checked anything. Now it reads pending alerts straight out
// of IndexedDB (the only storage a Service Worker can access - localStorage
// is off-limits here), fetches each alert's product from Firestore's public
// REST API (allowed by firestore.rules: products are world-readable), and
// fires a real local notification if the price has dropped to/below target.
const FIRESTORE_PROJECT_ID = 'sa3ry-pro';
const ALERTS_DB_NAME = 'sa3ryDB';

function openAlertsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ALERTS_DB_NAME, 2);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllAlerts(db) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('priceAlerts')) { resolve([]); return; }
    const tx = db.transaction('priceAlerts', 'readonly');
    const req = tx.objectStore('priceAlerts').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function deleteAlert(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction('priceAlerts', 'readwrite');
    tx.objectStore('priceAlerts').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function fetchProductMinPrice(productId) {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/products/${productId}`
    );
    if (!res.ok) return null;
    const doc = await res.json();
    const stores = doc.fields?.stores?.arrayValue?.value || [];
    const prices = stores
      .map(s => s.mapValue?.fields?.price?.integerValue || s.mapValue?.fields?.price?.doubleValue)
      .filter(Boolean)
      .map(Number);
    return prices.length ? Math.min(...prices) : null;
  } catch (e) {
    return null;
  }
}

async function checkPriceAlerts() {
  const db = await openAlertsDB();
  const alerts = await getAllAlerts(db);
  for (const alert of alerts) {
    const currentPrice = await fetchProductMinPrice(alert.productId);
    if (currentPrice !== null && currentPrice <= alert.targetPrice) {
      await self.registration.showNotification('🔔 انخفض السعر!', {
        body: `${alert.productName} وصل لـ ${currentPrice.toLocaleString()} ج.م`,
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [200, 100, 200],
        data: { productId: alert.productId }
      });
      await deleteAlert(db, alert.id);
    }
  }
}

self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-price-alerts') {
    e.waitUntil(checkPriceAlerts());
  }
});

// Periodic Background Sync (where supported, e.g. installed PWAs on Android)
// re-checks alerts every so often even without an explicit user action.
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'periodic-price-check') {
    e.waitUntil(checkPriceAlerts());
  }
});
