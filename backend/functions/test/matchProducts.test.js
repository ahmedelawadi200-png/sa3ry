const test = require('node:test');
const assert = require('node:assert/strict');
const { matchProducts, FUZZY_CONFIDENCE_THRESHOLD, FUZZY_REVIEW_FLOOR } = require('../src/matching/matchProducts');

test('matchProducts: exact SKU match groups items from different providers together', () => {
  const items = [
    { title: 'iPhone 15 Pro 256GB (Amazon)', sku: 'ASIN123', storeId: 's1', price: 55000, _brand: 'Apple', _providerName: 'amazon' },
    { title: 'iPhone 15 Pro 256GB Silver', sku: 'ASIN123', storeId: 's2', price: 54500, _brand: 'Apple', _providerName: 'manual' },
  ];
  const { matched } = matchProducts(items);
  const group = matched.find((g) => g.items.length === 2);
  assert.ok(group, 'expected a 2-item group from matching SKU');
  assert.equal(group.canonicalKey, 'sku:ASIN123');
});

test('matchProducts: identical normalized titles (same brand) match via canonical key', () => {
  const items = [
    { title: 'Samsung Galaxy S24', storeId: 's1', price: 30000, _brand: 'Samsung', _providerName: 'manual' },
    { title: 'samsung galaxy s24', storeId: 's2', price: 29500, _brand: 'Samsung', _providerName: 'manual' },
  ];
  const { matched } = matchProducts(items);
  const group = matched.find((g) => g.items.length === 2);
  assert.ok(group, 'expected case-insensitive title match to group together');
});

test('matchProducts: near-miss similarity (between floor and threshold) goes to review, not auto-merged', () => {
  const items = [
    { title: 'iPhone 15 Pro 256GB', storeId: 's1', price: 55000, _brand: 'Apple', _providerName: 'manual' },
    { title: 'iPhone 15 Pro Max 256GB', storeId: 's2', price: 65000, _brand: 'Apple', _providerName: 'manual' },
  ];
  const { matched, needsReview } = matchProducts(items);
  // Must NOT be auto-merged into one group.
  const merged = matched.find((g) => g.items.length === 2);
  assert.equal(merged, undefined, 'different products must not be silently auto-merged');
  // Must show up in the review queue since they ARE plausibly similar.
  assert.equal(needsReview.length, 1);
  assert.ok(needsReview[0].similarity >= FUZZY_REVIEW_FLOOR && needsReview[0].similarity < FUZZY_CONFIDENCE_THRESHOLD);
});

test('matchProducts: completely unrelated products are neither merged nor flagged for review', () => {
  const items = [
    { title: 'iPhone 15 Pro 256GB', storeId: 's1', price: 55000, _brand: 'Apple', _providerName: 'manual' },
    { title: 'Samsung Galaxy S24 Ultra', storeId: 's2', price: 45000, _brand: 'Samsung', _providerName: 'manual' },
  ];
  const { matched, needsReview } = matchProducts(items);
  assert.equal(needsReview.length, 0, 'unrelated products should not clutter the review queue');
  assert.equal(matched.length, 2, 'each should become its own standalone product group');
});

test('matchProducts: a genuine single-store product is still written as its own group', () => {
  const items = [
    { title: 'Sony WH-1000XM5', storeId: 's1', price: 12000, _brand: 'Sony', _providerName: 'manual' },
  ];
  const { matched, needsReview } = matchProducts(items);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].items.length, 1);
  assert.equal(needsReview.length, 0);
});

test('matchProducts: empty input returns empty results without throwing', () => {
  const { matched, needsReview } = matchProducts([]);
  assert.deepEqual(matched, []);
  assert.deepEqual(needsReview, []);
});

test('matchProducts: threshold values match the approved design (85% / 75%)', () => {
  assert.equal(FUZZY_CONFIDENCE_THRESHOLD, 0.85);
  assert.equal(FUZZY_REVIEW_FLOOR, 0.75);
});
