const ARABIC_INDIC_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const NOISE_WORDS = [
  'جديد', 'اصلي', 'أصلي', 'اورجينال', 'original', 'new', 'brand', 'genuine',
  'ضمان', 'warranty', 'مستعمل', 'used',
];

/**
 * Turns a raw product title into a normalized string suitable for exact-key
 * comparison: lowercase, Arabic-Indic digits converted to Latin, noise
 * words stripped, extra whitespace collapsed.
 */
function normalizeTitle(title) {
  if (!title) return '';
  let t = title.toLowerCase();
  t = t.replace(/[٠-٩]/g, (d) => ARABIC_INDIC_DIGITS[d] || d);
  t = t.replace(/[^\w\u0600-\u06FF\s]/g, ' '); // strip punctuation, keep Arabic letters/digits
  NOISE_WORDS.forEach((word) => {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Builds a canonical key from brand + normalized title, used for the
 * exact-match stage of matchProducts(). Two items with the same
 * canonicalKey are treated as the same product.
 */
function buildCanonicalKey(brand, title) {
  const normBrand = (brand || '').toLowerCase().trim();
  const normTitle = normalizeTitle(title);
  return `${normBrand}::${normTitle}`.replace(/\s+/g, '-');
}

/** Jaccard similarity over word sets - cheap, decent fuzzy-match signal. */
function titleSimilarity(a, b) {
  const wordsA = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  let intersection = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) intersection++; });
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

module.exports = { normalizeTitle, buildCanonicalKey, titleSimilarity };
