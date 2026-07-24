const test = require('node:test');
const assert = require('node:assert/strict');
const { assertValidProvider } = require('../src/providers/provider.interface');
const amazonProvider = require('../src/providers/amazon.provider');
const templateProvider = require('../src/providers/_template.provider');

test('provider.interface: a well-formed provider passes validation', () => {
  assert.doesNotThrow(() => assertValidProvider(amazonProvider));
  assert.doesNotThrow(() => assertValidProvider(templateProvider));
});

test('provider.interface: rejects a provider missing required fields', () => {
  assert.throws(
    () => assertValidProvider({ name: 'broken', sourceType: 'manual' }),
    /missing required field/
  );
});

test('provider.interface: rejects an invalid sourceType', () => {
  assert.throws(
    () => assertValidProvider({
      name: 'broken',
      sourceType: 'web-scraping', // not an allowed value - see provider.interface.js
      isConfigured: () => true,
      fetchProducts: async () => [],
    }),
    /invalid sourceType/
  );
});

test('amazon.provider: sourceType is official-api (never scraping)', () => {
  assert.equal(amazonProvider.sourceType, 'official-api');
});

test('amazon.provider: isConfigured() is false with no credentials set', () => {
  delete process.env.AMAZON_ACCESS_KEY;
  delete process.env.AMAZON_SECRET_KEY;
  delete process.env.AMAZON_PARTNER_TAG;
  assert.equal(amazonProvider.isConfigured(), false);
});

test('amazon.provider: fetchProducts() throws a clear error instead of silently returning [] when unconfigured', async () => {
  await assert.rejects(
    () => amazonProvider.fetchProducts({ categories: ['phones'] }),
    /credentials configured/
  );
});

test('amazon.provider: isConfigured() becomes true once all three env vars are set', () => {
  process.env.AMAZON_ACCESS_KEY = 'test-key';
  process.env.AMAZON_SECRET_KEY = 'test-secret';
  process.env.AMAZON_PARTNER_TAG = 'test-tag';
  assert.equal(amazonProvider.isConfigured(), true);
  delete process.env.AMAZON_ACCESS_KEY;
  delete process.env.AMAZON_SECRET_KEY;
  delete process.env.AMAZON_PARTNER_TAG;
});

test('_template.provider: ships disabled (isConfigured false) and returns no items - safe to register without config', async () => {
  assert.equal(templateProvider.isConfigured(), false);
  const items = await templateProvider.fetchProducts({ categories: [] });
  assert.deepEqual(items, []);
});
