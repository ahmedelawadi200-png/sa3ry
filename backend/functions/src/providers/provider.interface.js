/**
 * ==================== PROVIDER INTERFACE ====================
 * Every store provider (amazon.provider.js, noon.provider.js, ...) must
 * export an object matching this exact shape. This is the ONLY contract
 * the rest of the system depends on - orchestrator.js never knows anything
 * store-specific, it just calls this interface the same way for every
 * provider in the registry.
 *
 * To add a new store: copy _template.provider.js, fill it in, and add one
 * line in orchestrator.js's PROVIDERS array. Nothing else changes.
 *
 * @typedef {Object} RawItem
 * @property {string} title       - Product title exactly as the source gives it
 * @property {number} price       - Price as a plain number (no currency symbol)
 * @property {string} currency    - e.g. 'EGP'
 * @property {string} [url]       - Link to the product on the store's site
 * @property {string} [imageUrl]  - Product image
 * @property {string} [sku]       - Barcode/ASIN/SKU if the source provides one -
 *                                   this is the single most reliable signal for
 *                                   matching, always include it when available
 * @property {string} storeId     - Firestore doc id under /stores/{storeId}
 *                                   this item belongs to
 *
 * @typedef {Object} Provider
 * @property {string} name         - Unique key, e.g. 'amazon'
 * @property {'official-api'|'affiliate-feed'|'manual'} sourceType
 *   Declares HOW this provider gets its data. Purely informational today -
 *   surfaced in providerRuns / admin UI so it's always clear at a glance
 *   which providers are pulling from a sanctioned source vs. manual entry.
 *   New provider types must be one of these three; a provider must never
 *   silently scrape a site outside these categories.
 * @property {() => boolean} isConfigured
 *   Returns false if required credentials/env vars are missing - the
 *   orchestrator skips this provider entirely (no error) when this is false,
 *   so an unconfigured provider (e.g. amazon before you have API keys) is a
 *   complete no-op rather than a failure.
 * @property {(ctx: {categories: string[]}) => Promise<RawItem[]>} fetchProducts
 *   Returns raw items for the given categories. Must throw on hard failure
 *   (network error etc.) - the orchestrator catches it, logs it to
 *   providerRuns with status 'failed', and continues with the other
 *   providers rather than aborting the whole run.
 */

/** Throws a descriptive error if a provider module doesn't match the shape above. */
function assertValidProvider(provider) {
  const required = ['name', 'sourceType', 'isConfigured', 'fetchProducts'];
  const missing = required.filter((key) => !(key in provider));
  if (missing.length) {
    throw new Error(
      `Provider is missing required field(s): ${missing.join(', ')}. ` +
      `See provider.interface.js for the required shape.`
    );
  }
  if (!['official-api', 'affiliate-feed', 'manual'].includes(provider.sourceType)) {
    throw new Error(
      `Provider "${provider.name}" has an invalid sourceType "${provider.sourceType}". ` +
      `Must be one of: official-api, affiliate-feed, manual.`
    );
  }
}

module.exports = { assertValidProvider };
