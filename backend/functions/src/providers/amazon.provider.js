/**
 * ==================== AMAZON PROVIDER ====================
 * Uses Amazon's official Product Advertising API 5.0 (PA-API).
 *
 * STATUS: not usable yet on purpose. isConfigured() returns false until
 * you set the three environment variables below, so the orchestrator skips
 * this provider silently - it does not break or slow down a run.
 *
 * TO ACTIVATE (do this in your own time, not required to use the rest of
 * the system):
 *   1. Join the Amazon Associates program (free): https://affiliate-program.amazon.com
 *   2. Get 3 qualifying sales within 180 days - PA-API access only unlocks
 *      after that. This is Amazon's rule, not something this code can skip.
 *   3. Once approved, generate PA-API credentials from your Associate
 *      account and set these as Cloud Functions environment config:
 *        firebase functions:config:set amazon.access_key="..." amazon.secret_key="..." amazon.partner_tag="..."
 *   4. Install the official SDK: npm install paapi5-nodejs-sdk
 *   5. Fill in the fetchProducts() body below - the request shape is
 *      sketched out already, just needs your credentials wired through the
 *      SDK client.
 */

function getConfig() {
  const functions = require('firebase-functions');
  const cfg = functions.config().amazon || {};
  return {
    accessKey: cfg.access_key || process.env.AMAZON_ACCESS_KEY,
    secretKey: cfg.secret_key || process.env.AMAZON_SECRET_KEY,
    partnerTag: cfg.partner_tag || process.env.AMAZON_PARTNER_TAG,
  };
}

module.exports = {
  name: 'amazon',
  sourceType: 'official-api',

  isConfigured() {
    const { accessKey, secretKey, partnerTag } = getConfig();
    return Boolean(accessKey && secretKey && partnerTag);
  },

  async fetchProducts({ categories }) {
    const { accessKey, secretKey, partnerTag } = getConfig();

    // This should never actually run while isConfigured() is false, but
    // fail loudly (not silently return []) if it's ever called directly -
    // a silent empty result would look like "ran fine, found nothing"
    // instead of "not set up yet" in providerRuns.
    if (!accessKey || !secretKey || !partnerTag) {
      throw new Error(
        'amazon.provider.js called without credentials configured. ' +
        'Set amazon.access_key / amazon.secret_key / amazon.partner_tag via ' +
        '`firebase functions:config:set`, see the comment at the top of this file.'
      );
    }

    // ---- TODO: fill in once you have PA-API access ----
    // const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');
    // const client = ProductAdvertisingAPIv1.ApiClient.instance;
    // client.accessKey = accessKey;
    // client.secretKey = secretKey;
    // client.host = 'webservices.amazon.eg';   // use the correct regional host
    // client.region = 'eu-west-1';
    //
    // const api = new ProductAdvertisingAPIv1.DefaultApi();
    // const results = [];
    // for (const category of categories) {
    //   const searchRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
    //   searchRequest['PartnerTag'] = partnerTag;
    //   searchRequest['PartnerType'] = 'Associates';
    //   searchRequest['Keywords'] = category;
    //   searchRequest['SearchIndex'] = 'Electronics';
    //   searchRequest['ItemCount'] = 10;
    //   searchRequest['Resources'] = [
    //     'ItemInfo.Title', 'Offers.Listings.Price', 'Images.Primary.Medium'
    //   ];
    //   const response = await api.searchItems(searchRequest);
    //   for (const item of response.SearchResult?.Items || []) {
    //     results.push({
    //       title: item.ItemInfo?.Title?.DisplayValue,
    //       price: item.Offers?.Listings?.[0]?.Price?.Amount,
    //       currency: item.Offers?.Listings?.[0]?.Price?.Currency || 'EGP',
    //       url: item.DetailPageURL,
    //       imageUrl: item.Images?.Primary?.Medium?.URL,
    //       sku: item.ASIN,
    //       storeId: 'amazon-eg',   // must match a real doc id in /stores
    //     });
    //   }
    // }
    // return results;

    throw new Error('amazon.provider.js fetchProducts() is a template - implement steps above.');
  },
};
