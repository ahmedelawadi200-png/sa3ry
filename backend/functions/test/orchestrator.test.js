const test = require('node:test');
const assert = require('node:assert/strict');
const { runSync } = require('../src/orchestrator');

/** Minimal fake writeResults - just records what it was called with, no Firestore. */
function makeFakeWriter() {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    return { productsWritten: args.matched.length, reviewQueueEntries: args.needsReview.length };
  };
  fn.calls = calls;
  return fn;
}

function fakeProvider(name, { configured = true, items = [], behavior } = {}) {
  return {
    name,
    sourceType: 'manual',
    isConfigured: () => configured,
    fetchProducts: behavior || (async () => items),
  };
}

test('runSync: an unconfigured provider is skipped, not treated as an error', async () => {
  const writeResultsFn = makeFakeWriter();
  const result = await runSync({
    providers: [fakeProvider('offline-store', { configured: false })],
    writeResultsFn,
  });
  assert.equal(result.runsByProvider['offline-store'].status, 'skipped');
  assert.equal(result.runsByProvider['offline-store'].errors.length, 0);
});

test('runSync: one provider failing does not stop the others from running', async () => {
  const writeResultsFn = makeFakeWriter();
  const goodItems = [{ title: 'Test Product', storeId: 's1', price: 1000, _brand: 'TestBrand' }];

  const result = await runSync({
    providers: [
      fakeProvider('broken-store', { behavior: async () => { throw new Error('site is down'); } }),
      fakeProvider('working-store', { items: goodItems }),
    ],
    writeResultsFn,
  });

  assert.equal(result.runsByProvider['broken-store'].status, 'failed');
  assert.ok(result.runsByProvider['broken-store'].errors.length > 0);

  // The critical assertion: the OTHER provider still ran and succeeded.
  assert.equal(result.runsByProvider['working-store'].status, 'success');
  assert.equal(result.runsByProvider['working-store'].itemsFound, 1);

  // And its item made it all the way through to the writer.
  assert.equal(writeResultsFn.calls.length, 1);
  assert.equal(writeResultsFn.calls[0].matched.length, 1);
});

test('runSync: a provider that always times out is retried per the shared policy, then marked failed - run still completes', async () => {
  const writeResultsFn = makeFakeWriter();
  let callCount = 0;

  const result = await runSync({
    providers: [
      fakeProvider('always-hangs', {
        behavior: () => { callCount++; return new Promise(() => {}); }, // never resolves
      }),
    ],
    writeResultsFn,
  });

  // PROVIDER_RETRY_OPTS = { retries: 2, ... } -> 1 initial + 2 retries = 3 calls
  assert.equal(callCount, 3);
  assert.equal(result.runsByProvider['always-hangs'].status, 'failed');
  assert.match(result.runsByProvider['always-hangs'].errors.join(' '), /timed out/);
});

test('runSync: results from multiple healthy providers are all forwarded to the writer', async () => {
  const writeResultsFn = makeFakeWriter();
  await runSync({
    providers: [
      fakeProvider('store-a', { items: [{ title: 'Product A', storeId: 'a', price: 100, _brand: 'X' }] }),
      fakeProvider('store-b', { items: [{ title: 'Product B', storeId: 'b', price: 200, _brand: 'Y' }] }),
    ],
    writeResultsFn,
  });
  assert.equal(writeResultsFn.calls[0].matched.length, 2);
});
