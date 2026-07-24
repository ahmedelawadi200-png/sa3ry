const { assertValidProvider } = require('./providers/provider.interface');
const { matchProducts } = require('./matching/matchProducts');
const { writeResults } = require('./firestore/writeResults');
const { withRetryAndTimeout } = require('./utils/withRetryAndTimeout');

// ==================== PROVIDER REGISTRY ====================
// To add a new store: create yourstore.provider.js (copy _template.provider.js),
// then add one line here. Nothing else in the system changes.
const PROVIDERS = [
  require('./providers/manual.provider'),
  require('./providers/amazon.provider'),
  // require('./providers/noon.provider'),
];

const DEFAULT_CATEGORIES = ['phones', 'laptops', 'tablets', 'headphones', 'tvs', 'cameras', 'gaming', 'accessories'];

// Retry/timeout policy applied uniformly to every provider - a single
// provider can't hang the whole run, and a single provider can't need to
// implement its own retry logic.
const PROVIDER_RETRY_OPTS = { retries: 2, timeoutMs: 30000, backoffMs: 1000 };

function log(...args) {
  console.log(`[orchestrator ${new Date().toISOString()}]`, ...args);
}
function logError(...args) {
  console.error(`[orchestrator ${new Date().toISOString()}]`, ...args);
}

/**
 * Runs a full sync: calls every configured provider (with retry + timeout),
 * matches their combined results, and writes the outcome to Firestore.
 * Designed so one provider failing - or hanging - never aborts the others:
 * each is isolated in its own try/catch and gets its own entry in
 * providerRuns regardless of outcome.
 *
 * @param {{categories?: string[], providers?: Array}} opts
 *   `providers` defaults to the real PROVIDERS registry - overridable for
 *   tests, so orchestrator behavior (isolation, retry, logging) can be
 *   verified with fake providers instead of hitting real Firestore/APIs.
 */
async function runSync({ categories = DEFAULT_CATEGORIES, providers = PROVIDERS, writeResultsFn = writeResults } = {}) {
  providers.forEach(assertValidProvider);
  log(`starting run - ${providers.length} providers registered, categories: ${categories.join(', ')}`);

  const allItems = [];
  const runsByProvider = {};

  for (const provider of providers) {
    const startedAt = new Date();
    if (!provider.isConfigured()) {
      runsByProvider[provider.name] = {
        startedAt,
        status: 'skipped',
        itemsFound: 0,
        itemsMatched: 0,
        errors: [],
      };
      log(`${provider.name}: skipped (not configured)`);
      continue;
    }

    const attemptErrors = [];
    try {
      const items = await withRetryAndTimeout(
        () => provider.fetchProducts({ categories }),
        {
          ...PROVIDER_RETRY_OPTS,
          label: `${provider.name}.fetchProducts()`,
          onAttempt: (attemptNumber, err) => {
            if (err) {
              const isTimeout = err.code === 'TIMEOUT';
              attemptErrors.push(String(err.message || err));
              log(`${provider.name}: attempt ${attemptNumber} ${isTimeout ? 'timed out' : 'failed'} - ${err.message}`);
            } else if (attemptNumber > 1) {
              log(`${provider.name}: succeeded on attempt ${attemptNumber} (after ${attemptNumber - 1} retry/retries)`);
            }
          },
        }
      );
      items.forEach((item) => { item._providerName = provider.name; });
      allItems.push(...items);
      runsByProvider[provider.name] = {
        startedAt,
        status: 'success',
        itemsFound: items.length,
        itemsMatched: 0, // filled in after matching, below
        errors: attemptErrors, // retries that failed before the eventual success, if any - kept for visibility
      };
      log(`${provider.name}: fetched ${items.length} items`);
    } catch (err) {
      runsByProvider[provider.name] = {
        startedAt,
        status: 'failed',
        itemsFound: 0,
        itemsMatched: 0,
        errors: [...attemptErrors, String(err.message || err)],
      };
      logError(`${provider.name}: failed after all retries -`, err.message || err);
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

  const writeSummary = await writeResultsFn({ matched, needsReview, runsByProvider });

  log(
    `run complete - products written: ${writeSummary.productsWritten}, ` +
    `review queue: ${writeSummary.reviewQueueEntries}, confidence threshold: ${confidenceThreshold}, ` +
    `providers: ${Object.entries(runsByProvider).map(([name, r]) => `${name}=${r.status}`).join(', ')}`
  );

  return { ...writeSummary, runsByProvider };
}

module.exports = { runSync, PROVIDERS, DEFAULT_CATEGORIES, PROVIDER_RETRY_OPTS };
