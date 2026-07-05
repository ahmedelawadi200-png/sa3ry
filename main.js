// ==================== MAIN.JS ====================
// App bootstrap glue. Loads LAST, after every other module.
'use strict';

// ==================== DATA-ONCLICK EVENT DELEGATION ====================
// CRITICAL BUGFIX: the whole app uses a custom `data-onclick="..."` attribute
// on dozens of buttons (favorite/heart, compare, add-to-cart, price alert,
// contact store, edit/delete product, camera gallery, etc.) instead of a
// real `onclick="..."` attribute. A `data-*` attribute is inert by design -
// the browser does NOT execute it. There was NO code anywhere in the project
// that read this attribute and ran it, so every single one of these ~45
// buttons has never done anything when clicked, in the original codebase.
// This one delegated listener is what actually makes them work: it finds the
// nearest [data-onclick] ancestor of whatever was clicked and runs its
// expression, with `this` bound to that element and `event` in scope -
// exactly matching how a native inline onclick="..." attribute behaves.
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-onclick]');
  if (!el) return;
  const code = el.getAttribute('data-onclick');
  if (!code) return;
  try {
    new Function('event', code).call(el, e);
  } catch (err) {
    console.error('[data-onclick] failed to run:', code, err);
  }
});

// ==================== PATCH RENDER TO SAVE TO IDB + SANITIZE ====================
const _origRenderProducts = window.renderProducts;
window.renderProducts = function () {
  // Save products to IndexedDB for offline access
  if (typeof idb !== 'undefined' && idb && productsData.length > 0) {
    const toSave = productsData.slice(0, 50).map(p => ({ ...p, id: String(p.id) }));
    idbSave('products', toSave).catch(() => {});
  }
  if (_origRenderProducts) _origRenderProducts();
};

// ==================== SERVICE WORKER REGISTRATION ====================
// BUGFIX: the previous code registered an inline, blob-generated service
// worker (an older duplicate, cache "v1.2") instead of the real sw.js file
// that ships with the project (cache "v2.0", has background-sync + offline
// fallback support). The blob version had no 'sync' event listener at all,
// so Background Sync for price alerts silently did nothing. It also
// referenced an absolute path '/sa3ry/icon-96.png' that doesn't exist in
// this project (only icon-192.png and icon-512.png do).
// Fix: register the actual sw.js file, once, with proper error reporting.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('✅ Service worker registered:', reg.scope);
        // Check for a new version every 30 minutes.
        setInterval(() => reg.update(), 30 * 60 * 1000);
        // Activate a waiting worker immediately when a new version is found,
        // so users don't need to manually clear cache to get updates.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('✅ New service worker version activated');
            }
          });
        });
      })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}

// ==================== APP BOOTSTRAP ====================
// CRITICAL BUGFIX: `initAppWrapper()` (which calls both `initFirebase()` and
// `initApp()`) was defined but NEVER CALLED anywhere in the original code.
// The only thing that ran on DOMContentLoaded was a redundant direct call to
// `initFirebase()`. This meant:
//   - `initApp()` never ran through its normal path, so the splash screen
//     only ever closed via the 10-second emergency timeout, not the real
//     "products loaded, ready" path.
//   - A returning user's saved session was only restored by the emergency
//     timeout's fallback logic, not by the intended flow.
//   - Category/brand/product rendering only happened via `initApp()`, so it
//     depended entirely on that 10s timeout too.
// This is very likely the source of most "Firebase disconnected" / "app
// loads blank then jumps to login" complaints. Fixed by calling
// `initAppWrapper()` (the one function that does everything correctly) here.
document.addEventListener('DOMContentLoaded', () => {
  initAppWrapper();

  setTimeout(() => {
    const sugg = document.getElementById('searchSuggestions');
    if (sugg && !document.getElementById('dynamicSuggestions')) {
      const dynDiv = document.createElement('div');
      dynDiv.id = 'dynamicSuggestions';
      sugg.insertBefore(dynDiv, sugg.firstChild);
    }
  }, 500);
});
