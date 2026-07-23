const admin = require('firebase-admin');

/**
 * ==================== MANUAL PROVIDER ====================
 * This is NOT an external data source - it reads the products already in
 * Firestore (added through the existing sa3ry admin panel) and re-exposes
 * them as raw items in the standard provider shape.
 *
 * Why this exists: it lets the whole orchestrator/matching/write pipeline
 * run end-to-end and be validated safely, with zero external network calls
 * and zero risk, before any real external provider (Amazon etc.) is turned
 * on. It's also always "configured" - there's nothing to set up, since it's
 * just reading your own data back.
 */
module.exports = {
  name: 'manual',
  sourceType: 'manual',
  isConfigured: () => true,

  async fetchProducts({ categories }) {
    const db = admin.firestore();
    let query = db.collection('products');
    if (categories && categories.length) {
      query = query.where('category', 'in', categories.slice(0, 10)); // Firestore 'in' caps at 10
    }
    const snapshot = await query.get();

    const items = [];
    snapshot.forEach((doc) => {
      const product = doc.data();
      (product.stores || []).forEach((store) => {
        items.push({
          title: product.name,
          price: store.price,
          currency: 'EGP',
          url: store.link || '',
          imageUrl: product.image || (product.images && product.images[0]) || '',
          sku: product.slug || null,
          storeId: store.storeId || null,
          // Extra context kept for the matcher/writer - not part of the
          // required RawItem shape, but harmless to carry along.
          _existingProductId: doc.id,
          _brand: product.brand,
          _category: product.category,
        });
      });
    });
    return items;
  },
};
