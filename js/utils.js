// ==================== UTILS.JS ====================
// Generic helper functions: script loading, ID normalization,
// input sanitization, rate limiting, IndexedDB offline cache.
// No dependency on Firebase or DOM state - safe to load first.
'use strict';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Compresses/resizes an image file in the browser before upload, using a
 * canvas. Keeps aspect ratio, caps the longest side at maxDimension, and
 * re-encodes as JPEG at the given quality. Falls back to the original file
 * if anything goes wrong (e.g. unsupported format) so upload never breaks.
 */
function compressImage(file, { maxDimension = 1280, quality = 0.8 } = {}) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ==================== ID NORMALIZATION ====================
function normalizeId(id) {
  return String(id);
}
function getProductById(id) {
  return productsData.find(p => normalizeId(p.id) === normalizeId(id));
}

// ==================== INPUT SANITIZATION ====================
function sanitizeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Patch search to sanitize input
const _origPerformSearch = window.performSearch;
window.performSearch = function() {
  const input = document.getElementById('searchInput');
  if (input) input.value = input.value.replace(/<[^>]*>/g, '').slice(0, 100);
  if (_origPerformSearch) _origPerformSearch();
};

// ==================== RATE LIMITING ====================
const _apiCallLog = {};
function rateLimit(key, maxCalls = 5, windowMs = 60000) {
  const now = Date.now();
  if (!_apiCallLog[key]) _apiCallLog[key] = [];
  _apiCallLog[key] = _apiCallLog[key].filter(t => now - t < windowMs);
  if (_apiCallLog[key].length >= maxCalls) {
    showToast && showToast('warning', 'تنبيه', 'كثرت الطلبات، انتظر قليلاً');
    return false;
  }
  _apiCallLog[key].push(now);
  return true;
}

// Patch addProductToFirestore to rate limit
const _origAdd = window.addProductToFirestore;
if (_origAdd) {
  window.addProductToFirestore = function(product) {
    if (!rateLimit('addProduct', 10, 60000)) return Promise.reject(new Error('rate limited'));
    return _origAdd(product);
  };
}

// ==================== INDEXEDDB FOR OFFLINE PRODUCTS ====================
const DB_NAME = 'sa3ryDB';
const DB_VERSION = 2; // bumped: v2 adds the priceAlerts store
let idb = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('searches')) {
        db.createObjectStore('searches', { keyPath: 'query' });
      }
      // NEW: price alerts need to live in IndexedDB (not just localStorage)
      // because the Service Worker's Background Sync handler runs in a
      // separate context that cannot access localStorage - only IndexedDB.
      if (!db.objectStoreNames.contains('priceAlerts')) {
        db.createObjectStore('priceAlerts', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(store, data) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = Array.isArray(data)
        ? (data.forEach(item => os.put(item)), tx)
        : os.put(data);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) { console.warn('IDB save failed:', e); }
}

async function idbGetAll(store) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  } catch(e) { return []; }
}

async function idbDelete(store, key) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) {}
}

// Init IndexedDB on load
openDB().then(() => {
  console.log('✅ IndexedDB ready');
  // Load cached products if offline
  if (!navigator.onLine) {
    idbGetAll('products').then(cached => {
      if (cached.length > 0) {
        const existingIds = new Set(productsData.map(p => p.id));
        cached.forEach(p => { if (!existingIds.has(p.id)) productsData.unshift(p); });
        renderProducts && renderProducts();
        console.log('📦 Loaded', cached.length, 'products from IndexedDB (offline)');
      }
    });
  }
}).catch(() => {});

