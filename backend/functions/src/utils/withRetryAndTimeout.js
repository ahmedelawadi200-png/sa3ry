/**
 * ==================== RETRY + TIMEOUT WRAPPER ====================
 * Shared by the orchestrator for every provider call, so no individual
 * provider file has to reimplement this - a provider just returns a
 * plain Promise from fetchProducts(), and this wraps it.
 */

/** Rejects with a TimeoutError if `promise` doesn't settle within `ms`. */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Calls `fn` (a function returning a Promise), retrying up to `retries`
 * times with exponential backoff if it throws/rejects. Each individual
 * attempt is itself subject to `timeoutMs`. Calls `onAttempt(attemptNumber,
 * error|null)` after every attempt for logging.
 */
async function withRetryAndTimeout(fn, { retries = 2, timeoutMs = 30000, backoffMs = 1000, label = 'operation', onAttempt } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await withTimeout(fn(), timeoutMs, label);
      if (onAttempt) onAttempt(attempt, null);
      return result;
    } catch (err) {
      lastError = err;
      if (onAttempt) onAttempt(attempt, err);
      if (attempt <= retries) {
        const delay = backoffMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s, ...
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { withTimeout, withRetryAndTimeout };
