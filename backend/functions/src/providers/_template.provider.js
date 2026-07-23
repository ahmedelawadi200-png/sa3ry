/**
 * ==================== NEW STORE PROVIDER TEMPLATE ====================
 * Copy this file, rename it to yourstore.provider.js, fill in the four
 * fields below, and add one line for it in orchestrator.js's PROVIDERS
 * array. That's the entire integration surface - nothing else in the
 * system needs to know this store exists.
 *
 * Before writing fetchProducts(): confirm you have a LEGITIMATE data
 * source for this store - an official API, or an affiliate/partner feed
 * they provide. Do not point this at scraping the store's own website
 * unless you've reviewed their Terms of Service and robots.txt yourself
 * and are comfortable with that risk - this template deliberately doesn't
 * ship with scraping logic.
 */
module.exports = {
  name: 'yourstore',                 // unique key, lowercase, no spaces
  sourceType: 'affiliate-feed',      // 'official-api' | 'affiliate-feed' | 'manual'

  isConfigured() {
    // Return false until whatever credentials/feed URL this needs are set.
    // An unconfigured provider is silently skipped, never an error.
    return false;
  },

  async fetchProducts({ categories }) {
    // Return an array of RawItem objects - see provider.interface.js for
    // the exact shape (title, price, currency, url, imageUrl, sku, storeId).
    return [];
  },
};
