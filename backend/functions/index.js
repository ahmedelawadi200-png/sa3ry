const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { runSync } = require('./src/orchestrator');

admin.initializeApp();

/**
 * ==================== SCHEDULED SYNC ====================
 * Runs every 12 hours (per approved design). Timezone set to Egypt so the
 * schedule is easy to reason about from the Firebase Console.
 */
exports.scheduledPriceSync = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 12 hours')
  .timeZone('Africa/Cairo')
  .onRun(async () => {
    await runSync();
    return null;
  });

/**
 * ==================== MANUAL TRIGGER (for testing) ====================
 * HTTPS-callable so you can trigger a sync on demand from the Firebase
 * Console / curl, without waiting for the schedule. Requires the caller to
 * be signed in AND have an /admins/{uid} doc, same rule as the rest of the
 * admin-only actions in the app.
 */
exports.triggerPriceSync = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'هذه العملية تتطلب صلاحية إدارة');
    }
    return runSync(data || {});
  });
