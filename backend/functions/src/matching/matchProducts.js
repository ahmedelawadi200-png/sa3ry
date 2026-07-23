const { buildCanonicalKey, titleSimilarity } = require('./normalizeTitle');

const FUZZY_CONFIDENCE_THRESHOLD = 0.85; // auto-merge at/above this (per approved design)
const FUZZY_REVIEW_FLOOR = 0.75;         // 75%-85% goes to the review queue instead of auto-merging

/**
 * Groups raw items from all providers into matched product groups.
 *
 * @param {Array} rawItems - flattened RawItem[] from every provider's fetchProducts()
 * @returns {{ matched: Array<{canonicalKey:string, items:Array}>, needsReview: Array }}
 *   `matched` = groups confident enough to write straight to Firestore -
 *   this includes legitimate single-store products, not just multi-store
 *   matches.
 *   `needsReview` = pairs with a *plausible but not confident* similarity
 *   (between FUZZY_REVIEW_FLOOR and FUZZY_CONFIDENCE_THRESHOLD) - these are
 *   NOT auto-merged; they're returned separately so an admin can confirm
 *   manually instead of risking two different products getting silently
 *   merged into one, or two prices for the same product staying split.
 */
function matchProducts(rawItems) {
  // ---- Stage 1: exact SKU match ----
  const bySku = new Map();
  const noSku = [];
  for (const item of rawItems) {
    if (item.sku) {
      const key = `sku:${item.sku}`;
      if (!bySku.has(key)) bySku.set(key, []);
      bySku.get(key).push(item);
    } else {
      noSku.push(item);
    }
  }

  // ---- Stage 2: canonical key (brand + normalized title) ----
  const byCanonicalKey = new Map();
  for (const item of noSku) {
    const key = buildCanonicalKey(item._brand, item.title);
    if (!byCanonicalKey.has(key)) byCanonicalKey.set(key, []);
    byCanonicalKey.get(key).push(item);
  }

  const matched = [];
  for (const [key, items] of bySku) matched.push({ canonicalKey: key, items });

  // Canonical-key groups of size 1 go through fuzzy matching (stage 3)
  // against each other; groups of size 2+ are already confident matches.
  const singletons = [];
  for (const [key, items] of byCanonicalKey) {
    if (items.length > 1) matched.push({ canonicalKey: key, items });
    else singletons.push(items[0]);
  }

  // ---- Stage 3: fuzzy match remaining singletons against each other ----
  const needsReview = [];
  const consumed = new Set();

  for (let i = 0; i < singletons.length; i++) {
    if (consumed.has(i)) continue;
    const group = [singletons[i]];
    let bestNearMiss = null; // {j, similarity} - best candidate below the auto-merge bar

    for (let j = i + 1; j < singletons.length; j++) {
      if (consumed.has(j)) continue;
      const similarity = titleSimilarity(singletons[i].title, singletons[j].title);
      if (similarity >= FUZZY_CONFIDENCE_THRESHOLD) {
        group.push(singletons[j]);
        consumed.add(j);
      } else if (similarity >= FUZZY_REVIEW_FLOOR && (!bestNearMiss || similarity > bestNearMiss.similarity)) {
        bestNearMiss = { j, similarity };
      }
    }

    if (group.length > 1) {
      // Confident multi-item match - write straight through.
      matched.push({ canonicalKey: buildCanonicalKey(group[0]._brand, group[0].title), items: group });
    } else {
      // No confident match. Still a legitimate single-source product -
      // write it as its own group either way.
      matched.push({ canonicalKey: buildCanonicalKey(group[0]._brand, group[0].title), items: group });
      // But if there was a plausible-but-uncertain candidate, flag the pair
      // for manual review too (informational - doesn't block the write above).
      if (bestNearMiss) {
        needsReview.push({
          itemA: singletons[i],
          itemB: singletons[bestNearMiss.j],
          similarity: bestNearMiss.similarity,
        });
      }
    }
  }

  return { matched, needsReview, confidenceThreshold: FUZZY_CONFIDENCE_THRESHOLD };
}

module.exports = { matchProducts, FUZZY_CONFIDENCE_THRESHOLD, FUZZY_REVIEW_FLOOR };
