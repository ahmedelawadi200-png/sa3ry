const { assertValidProvider } = require('./providers/provider.interface');
const { matchProducts } = require('./matching/matchProducts');
const { writeResults } = require('./firestore/writeResults');

// ==================== PROVIDER REGISTRY ====================
// To add a new store: create yourstore.provider.js (copy _template.provider.js),
// then add one line here. Nothing else in the system changes.
const PROVIDERS = [
  require('./providers/manual.provider'),
  require('./providers/amazon.provider'),
  // require('./providers/noon.provider'),
];

const DEFAULT_CATEGORIES = ['phones', 'laptops', 'tablets', 'headphones', 'tvs', 'cameras', 'gaming', 'accessories'];

/**
 * Runs a full sync: calls every configured provider, matches their combined
 * results, and writes the outcome to Firestore. Designed so one provider
 * failing never aborts the others - each is isolated in its own try/catch
 * and gets its own entry in providerRuns regardless of outcome.
 */
async function runSync({ categories = DEFAULT_CATEGORIES } = {}) {
  PROVIDERS.forEach(assertValidProvider);

  const allItems = [];
  const runsByProvider = {};

  for (const provider of PROVIDERS) {
    const startedAt = new Date();
    if (!provider.isConfigured()) {
      runsByProvider[provider.name] = {
        startedAt,
        status: 'skipped',
        itemsFound: 0,
        itemsMatched: 0,
        errors: [],
      };
      console.log(`[orchestrator] ${provider.name}: skipped (not configured)`);
      continue;
    }

    try {
      const items = await provider.fetchProducts({ categories });
      items.forEach((item) => { item._providerName = provider.name; });
      allItems.push(...items);
      runsByProvider[provider.name] = {
        startedAt,
        status: 'success',
        itemsFound: items.length,
        itemsMatched: 0, // filled in after matching, below
        errors: [],
      };
      console.log(`[orchestrator] ${provider.name}: fetched ${items.length} items`);
    } catch (err) {
      runsByProvider[provider.name] = {
        startedAt,
        status: 'failed',
        itemsFound: 0,
        itemsMatched: 0,
        errors: [String(err.message || err)],
      };
      console.error(`[orchestrator] ${provider.name} failed:`, err);
      // Deliberately no throw here - one provider failing must not stop the others.
    }
  }

  const { matched, needsReview, confidenceThreshold } = matchProducts(allItems);

  // Attribute matched item counts back to each provider for the health dashboard.
  matched.forEach((group) => {
    group.items.forEach((item) => {
      if (runsByProvider[item._providerName]) runsByProvider[item._providerName].itemsMatched++;
    });
  });

  const writeSummary = await writeResults({ matched, needsReview, runsByProvider });

  console.log(
    `[orchestrator] done. products written: ${writeSummary.productsWritten}, ` +
    `review queue: ${writeSummary.reviewQueueEntries}, confidence threshold: ${confidenceThreshold}`
  );

  return { ...writeSummary, runsByProvider };
}

module.exports = { runSync, PROVIDERS, DEFAULT_CATEGORIES };
