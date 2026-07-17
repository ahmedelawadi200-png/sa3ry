// ==================== FIREBASE.JS ====================
// Firebase initialization, connection handling, and admin-role verification.
// Depends on: utils.js (loadScript). Must load before auth.js, admin.js, products.js.
'use strict';

const firebaseConfig = {
  apiKey: "AIzaSyCOHBV9P-ySBIRSQB9KEP-V9778EaC80vU",
  authDomain: "sa3ry-pro.firebaseapp.com",
  projectId: "sa3ry-pro",
  storageBucket: "sa3ry-pro.firebasestorage.app",
  messagingSenderId: "1095877859009",
  appId: "1:1095877859009:web:6418f746359da6b8eca640",
  measurementId: "G-RXS93VVJF1"
};

let auth = null;
let db = null;
let googleProvider = null;
let facebookProvider = null;
let recaptchaVerifier = null;
let confirmationResult = null;

// True once Firebase SDKs + app are ready to use.
let firebaseReady = false;
// True only after we've confirmed (via Firestore) that the signed-in user
// is a real admin. Never trust a client-side flag alone for security -
// Firestore Rules are the actual enforcement layer (see firestore.rules).
let isAdminUser = false;

/**
 * Loads the Firebase compat SDKs from a CDN, falling back to a mirror if the
 * primary CDN fails. Resolves to false (never throws) so app boot never hard-fails.
 */
async function loadFirebaseSDK() {
  const cdnBase = [
    'https://www.gstatic.com/firebasejs/10.13.2',
    'https://cdn.jsdelivr.net/npm/firebase@10.13.2/compat'
  ];

  for (const base of cdnBase) {
    try {
      await loadScript(`${base}/firebase-app-compat.js`);
      await loadScript(`${base}/firebase-auth-compat.js`);
      await loadScript(`${base}/firebase-firestore-compat.js`);
      return true;
    } catch (e) {
      console.warn('[firebase] CDN failed, trying next mirror...', base);
    }
  }
  return false;
}

/**
 * Initializes Firebase exactly once. Safe to call multiple times - guarded by
 * firebase.apps.length AND our own firebaseReady flag so re-entrant calls
 * (e.g. a stray extra DOMContentLoaded listener) never double-init.
 */
async function initFirebase() {
  if (firebaseReady) return true;

  const loaded = await loadFirebaseSDK();
  if (!loaded) {
    console.error('[firebase] All CDNs failed - app will run in offline/demo mode');
    showConnectionBanner && showConnectionBanner(false);
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    auth.languageCode = 'ar';
    db = firebase.firestore();

    // Better offline resilience: cache Firestore reads/writes locally so the
    // app keeps working (read-only) when the network drops mid-session.
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      // Expected in multi-tab scenarios or unsupported browsers - not fatal.
      if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
        console.warn('[firebase] Persistence not enabled:', e.code);
      }
    }

    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    facebookProvider = new firebase.auth.FacebookAuthProvider();
    facebookProvider.setCustomParameters({ display: 'popup' });

    firebaseReady = true;
    console.log('✅ Firebase initialized successfully');
    showConnectionBanner && showConnectionBanner(true);

    // Keep isAdminUser in sync with the actual signed-in user at all times.
    auth.onAuthStateChanged(async (user) => {
      isAdminUser = user ? await checkAdminStatus(user.uid) : false;
      document.dispatchEvent(new CustomEvent('sa3ry:admin-status', { detail: { isAdmin: isAdminUser } }));
    });

    loadProductsFromFirestore();
    return true;
  } catch (e) {
    console.error('[firebase] Init error:', e);
    showConnectionBanner && showConnectionBanner(false);
    return false;
  }
}

/**
 * SECURITY: real admin verification.
 * A user is an admin only if a document exists at /admins/{uid} in Firestore.
 * This is enforced both here (so the UI hides admin controls) AND in
 * firestore.rules (so the check can never be bypassed from the browser
 * console or a forged request - see firestore.rules in the project root).
 */
async function checkAdminStatus(uid) {
  if (!db || !uid) return false;
  try {
    const doc = await db.collection('admins').doc(uid).get();
    return doc.exists === true;
  } catch (e) {
    console.warn('[firebase] Could not verify admin status:', e.code || e.message);
    return false;
  }
}

/** Small connectivity indicator so the UI can react to Firebase being down. */
function showConnectionBanner(connected) {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  if (!connected) {
    banner.classList.add('show');
    banner.querySelector('span') && (banner.querySelector('span').textContent = 'تعذر الاتصال بالخادم - وضع عدم الاتصال');
  } else if (navigator.onLine) {
    banner.classList.remove('show');
  }
}
