const admin = require('firebase-admin');

const FIRESTORE_BATCH_LIMIT = 500;

/** Splits an array into chunks of at most `size`. */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Writes a matched product group to /products. If the group came from the
 * 'manual' provider (has _existingProductId), it updates that exact doc in
 * place rather than creating a duplicate - this is what keeps the pipeline
 * a safe no-op resync in phase 1 (manual-only), instead of duplicating
 * every product on every run.
 */
function buildProductWrite(db, group) {
  const { canonicalKey, items } = group;
  const first = items[0];
  const existingId = items.find((i) => i._existingProductId)?._existingProductId;

  const stores = items.map((item) => ({
    storeId: item.storeId,
    price: item.price,
    link: item.url || '',
  }));

  const sources = items.map((item) => ({
    storeId: item.storeId,
    providerName: item._providerName,
    sourceUrl: item.url || '',
    lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
  }));

  const payload = {
    name: first.title,
    brand: first._brand || '',
    category: first._category || '',
    canonicalKey,
    stores,
    sources,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = existingId ? db.collection('products').doc(existingId) : db.collection('products').doc();
  return { ref, payload, isNew: !existingId };
}

/**
 * Commits a full sync result to Firestore: matched product groups (batched,
 * 500-op limit respected), review-queue entries for ambiguous matches, and
 * a providerRuns summary document per provider used for the health
 * dashboard.
 */
async function writeResults({ matched, needsReview, runsByProvider }) {
  const db = admin.firestore();

  // ---- Matched products, batched ----
  const writes = matched.map((group) => buildProductWrite(db, group));
  for (const batchItems of chunk(writes, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();
    batchItems.forEach(({ ref, payload }) => batch.set(ref, payload, { merge: true }));
    await batch.commit();
  }

  // ---- Review queue entries ----
  if (needsReview.length) {
    for (const pairBatch of chunk(needsReview, FIRESTORE_BATCH_LIMIT)) {
      const batch = db.batch();
      pairBatch.forEach((pair) => {
        const ref = db.collection('reviewQueue').doc();
        batch.set(ref, {
          itemA: { title: pair.itemA.title, storeId: pair.itemA.storeId, price: pair.itemA.price },
          itemB: { title: pair.itemB.title, storeId: pair.itemB.storeId, price: pair.itemB.price },
          similarity: pair.similarity,
          status: 'pending', // 'pending' | 'confirmed' | 'rejected' - set by an admin
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  // ---- Provider run summaries (health dashboard data) ----
  const batch = db.batch();
  for (const [providerName, stats] of Object.entries(runsByProvider)) {
    const ref = db.collection('providerRuns').doc();
    batch.set(ref, {
      providerName,
      startedAt: stats.startedAt,
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: stats.status,
      itemsFound: stats.itemsFound,
      itemsMatched: stats.itemsMatched,
      errors: stats.errors,
    });
  }
  await batch.commit();

  return {
    productsWritten: writes.length,
    reviewQueueEntries: needsReview.length,
  };
}

module.exports = { writeResults, buildProductWrite, chunk };
