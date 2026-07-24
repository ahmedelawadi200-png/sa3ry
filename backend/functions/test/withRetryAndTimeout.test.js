const test = require('node:test');
const assert = require('node:assert/strict');
const { withTimeout, withRetryAndTimeout } = require('../src/utils/withRetryAndTimeout');

test('withTimeout: resolves normally when the promise finishes in time', async () => {
  const result = await withTimeout(Promise.resolve('ok'), 1000, 'test');
  assert.equal(result, 'ok');
});

test('withTimeout: rejects with a TIMEOUT-coded error when the promise takes too long', async () => {
  const neverResolves = new Promise(() => {});
  await assert.rejects(
    () => withTimeout(neverResolves, 50, 'slow-op'),
    (err) => {
      assert.match(err.message, /slow-op timed out after 50ms/);
      assert.equal(err.code, 'TIMEOUT');
      return true;
    }
  );
});

test('withRetryAndTimeout: succeeds immediately without retrying if the first attempt works', async () => {
  let calls = 0;
  const result = await withRetryAndTimeout(async () => { calls++; return 'done'; }, { retries: 2, timeoutMs: 1000, backoffMs: 1 });
  assert.equal(result, 'done');
  assert.equal(calls, 1);
});

test('withRetryAndTimeout: retries on failure and eventually succeeds', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 3) throw new Error('flaky failure');
    return 'recovered';
  };
  const result = await withRetryAndTimeout(fn, { retries: 3, timeoutMs: 1000, backoffMs: 1 });
  assert.equal(result, 'recovered');
  assert.equal(calls, 3);
});

test('withRetryAndTimeout: gives up and throws the last error after exhausting all retries', async () => {
  let calls = 0;
  const fn = async () => { calls++; throw new Error('always fails'); };
  await assert.rejects(
    () => withRetryAndTimeout(fn, { retries: 2, timeoutMs: 1000, backoffMs: 1 }),
    /always fails/
  );
  assert.equal(calls, 3); // 1 initial attempt + 2 retries
});

test('withRetryAndTimeout: onAttempt callback reports each attempt (for provider run logging)', async () => {
  const attempts = [];
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 2) throw new Error('first attempt fails');
    return 'ok';
  };
  await withRetryAndTimeout(fn, {
    retries: 2,
    timeoutMs: 1000,
    backoffMs: 1,
    onAttempt: (n, err) => attempts.push({ n, failed: !!err }),
  });
  assert.deepEqual(attempts, [{ n: 1, failed: true }, { n: 2, failed: false }]);
});

test('withRetryAndTimeout: a stuck (never-resolving) provider call is retried, not left hanging forever', async () => {
  let calls = 0;
  const fn = () => {
    calls++;
    if (calls === 1) return new Promise(() => {}); // hangs forever on first attempt
    return Promise.resolve('recovered after hang');
  };
  const result = await withRetryAndTimeout(fn, { retries: 1, timeoutMs: 30, backoffMs: 1 });
  assert.equal(result, 'recovered after hang');
  assert.equal(calls, 2);
});
