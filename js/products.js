// ==================== PRODUCTS.JS ====================
// Firestore product CRUD, demo product data, category/brand/price/sort
// filters, product rendering, store-brand system, reviews, product detail
// page, price alerts/history, favorites, compare, cart, recently viewed,
// and Google price search.
// Depends on: firebase.js (db, isAdminUser), utils.js.
'use strict';

// ==================== FIRESTORE PRODUCTS ====================
const FIRESTORE_PAGE_SIZE = 20;
// BUGFIX: loadProductsFromFirestore used to unshift into productsData with
// no guard, so if it was ever called twice (e.g. a reconnect) every product
// would be duplicated in the list. These two flags prevent that.
let _firestoreProductsLoaded = false;
let _lastProductDoc = null;   // Firestore cursor for pagination
let _hasMoreProducts = true;

async function loadProductsFromFirestore() {
  if (_firestoreProductsLoaded) return; // guard against duplicate loads
  _firestoreProductsLoaded = true;
  try {
    const snapshot = await db.collection('products')
      .orderBy('createdAt', 'desc')
      .limit(FIRESTORE_PAGE_SIZE)
      .get();

    if (!snapshot.empty) {
      const firestoreProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      productsData.unshift(...firestoreProducts);
      _lastProductDoc = snapshot.docs[snapshot.docs.length - 1];
      _hasMoreProducts = snapshot.docs.length === FIRESTORE_PAGE_SIZE;
      renderProducts();
      renderBrandFilters();
      console.log('✅ Loaded', firestoreProducts.length, 'products from Firestore');
    } else {
      _hasMoreProducts = false;
    }
  } catch (e) {
    console.error('Error loading products:', e);
    _firestoreProductsLoaded = false; // allow a retry on the next call
  }
}

/** Pagination: fetch the next page of products (e.g. on "load more" / infinite scroll). */
async function loadMoreProductsFromFirestore() {
  if (!_hasMoreProducts || !_lastProductDoc) return [];
  try {
    const snapshot = await db.collection('products')
      .orderBy('createdAt', 'desc')
      .startAfter(_lastProductDoc)
      .limit(FIRESTORE_PAGE_SIZE)
      .get();

    const more = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (more.length) {
      productsData.push(...more);
      _lastProductDoc = snapshot.docs[snapshot.docs.length - 1];
      renderProducts();
    }
    _hasMoreProducts = snapshot.docs.length === FIRESTORE_PAGE_SIZE;
    return more;
  } catch (e) {
    console.error('Error loading more products:', e);
    return [];
  }
}

/**
 * SECURITY: server-side rules (firestore.rules) are the real gatekeeper, but
 * we also check isAdminUser here so a non-admin gets an instant, friendly
 * error instead of waiting on a network round-trip that Firestore will
 * reject anyway.
 */
async function addProductToFirestore(product) {
  if (!isAdminUser) throw new Error('غير مصرح لك بإضافة منتجات');
  // BUGFIX: rate limiting for this function used to be applied via a
  // monkey-patch in utils.js that ran at page load, BEFORE this function
  // even existed (utils.js loads first, products.js loads later in the
  // script order). `window.addProductToFirestore` was undefined at that
  // point, so the patch silently never attached - there was effectively no
  // rate limit at all. Enforcing it directly here fixes that for good.
  if (!rateLimit('addProduct', 10, 60000)) throw new Error('rate limited');
  try {
    product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    product.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('products').add(product);
    console.log('✅ Product added:', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding product:', e);
    throw e;
  }
}

/** NEW: product editing was requested but never implemented - it simply didn't exist before. */
async function updateProductInFirestore(productId, product) {
  if (!isAdminUser) throw new Error('غير مصرح لك بتعديل المنتجات');
  if (!rateLimit('updateProduct', 15, 60000)) throw new Error('rate limited');
  try {
    product.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('products').doc(productId).update(product);
    console.log('✅ Product updated:', productId);
  } catch (e) {
    console.error('Error updating product:', e);
    throw e;
  }
}

async function deleteProductFromFirestore(productId) {
  if (!isAdminUser) throw new Error('غير مصرح لك بحذف المنتجات');
  try {
    await db.collection('products').doc(productId).delete();
    console.log('✅ Product deleted:', productId);
  } catch (e) {
    console.error('Error deleting product:', e);
    throw e;
  }
}

/** Duplicate-prevention: same name + brand already exists among loaded products. */
function isDuplicateProduct(name, brand, excludeId) {
  const n = name.trim().toLowerCase();
  const b = brand.trim().toLowerCase();
  return productsData.some(p =>
    normalizeId(p.id) !== normalizeId(excludeId || '') &&
    p.name.trim().toLowerCase() === n &&
    p.brand.trim().toLowerCase() === b
  );
}

// ==================== DATA ====================
const categories = [
  {id:'phones',name:'موبايلات',icon:'📱',color:'#1a73e8'},
  {id:'laptops',name:'لابتوبات',icon:'💻',color:'#7b1fa2'},
  {id:'tablets',name:'تابلت',icon:'📟',color:'#00c853'},
  {id:'headphones',name:'سماعات',icon:'🎧',color:'#ff6d00'},
  {id:'tvs',name:'تلفزيونات',icon:'📺',color:'#c2185b'},
  {id:'cameras',name:'كاميرات',icon:'📷',color:'#00695c'},
  {id:'gaming',name:'ألعاب',icon:'🎮',color:'#558b2f'},
  {id:'accessories',name:'إكسسوارات',icon:'🔌',color:'#303f9f'}
];

const brands = ['Apple','Samsung','Sony','Huawei','Xiaomi','Dell','HP','Lenovo','Canon','Nintendo'];

const productsData = [
  {id:1,name:'iPhone 15 Pro Max 256GB',brand:'Apple',category:'phones',icon:'📱',rating:4.8,reviews:1250,stores:[
    {name:'ب.Tech',price:68900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:67500,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:69900,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Elaraby Group',price:72000,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'}
  ]},
  {id:2,name:'Samsung Galaxy S24 Ultra 256GB',brand:'Samsung',category:'phones',icon:'📱',rating:4.7,reviews:980,stores:[
    {name:'ب.Tech',price:54900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:53500,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:55900,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:3,name:'Sony WH-1000XM5 سماعات',brand:'Sony',category:'headphones',icon:'🎧',rating:4.6,reviews:650,stores:[
    {name:'ب.Tech',price:8900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:8200,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:9500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:4,name:'MacBook Pro 14 M3 Pro',brand:'Apple',category:'laptops',icon:'💻',rating:4.9,reviews:420,stores:[
    {name:'ب.Tech',price:89900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:87500,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'iStore',price:92000,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'}
  ]},
  {id:5,name:'Huawei MatePad Pro 11',brand:'Huawei',category:'tablets',icon:'📟',rating:4.5,reviews:310,stores:[
    {name:'ب.Tech',price:18900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:17500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:6,name:'Samsung 55" QLED 4K Smart TV',brand:'Samsung',category:'tvs',icon:'📺',rating:4.7,reviews:780,stores:[
    {name:'ب.Tech',price:24900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Elaraby Group',price:23500,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:25900,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:7,name:'Canon EOS R6 Mark II',brand:'Canon',category:'cameras',icon:'📷',rating:4.8,reviews:290,stores:[
    {name:'ب.Tech',price:125000,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:119000,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:8,name:'Nintendo Switch OLED',brand:'Nintendo',category:'gaming',icon:'🎮',rating:4.6,reviews:1100,stores:[
    {name:'ب.Tech',price:12900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:11800,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:13500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:9,name:'Xiaomi Redmi Note 13 Pro',brand:'Xiaomi',category:'phones',icon:'📱',rating:4.4,reviews:1560,stores:[
    {name:'ب.Tech',price:10900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:10200,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:11500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:10,name:'Dell XPS 15 9530',brand:'Dell',category:'laptops',icon:'💻',rating:4.5,reviews:380,stores:[
    {name:'ب.Tech',price:75900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:73500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:11,name:'HP Spectre x360 14',brand:'HP',category:'laptops',icon:'💻',rating:4.3,reviews:220,stores:[
    {name:'ب.Tech',price:62900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:61500,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]},
  {id:12,name:'Sony PlayStation 5',brand:'Sony',category:'gaming',icon:'🎮',rating:4.9,reviews:2100,stores:[
    {name:'ب.Tech',price:24900,location:'القاهرة',phone:'0123456789',whatsapp:'20123456789'},
    {name:'Amazon Egypt',price:23500,location:'أونلاين',phone:'',whatsapp:'20123456789'},
    {name:'Noon',price:25900,location:'أونلاين',phone:'',whatsapp:'20123456789'}
  ]}
];

const notificationsData = [
  {id:1,title:'انخفاض سعر iPhone 15',desc:'سعر iPhone 15 Pro Max نزل 2000 جنيه في Amazon Egypt',type:'price-drop',time:'منذ 10 دقائق',unread:true},
  {id:2,title:'منتج جديد متاح',desc:'Samsung Galaxy S24 Ultra متاح الآن في ب.Tech',type:'new-product',time:'منذ ساعة',unread:true},
  {id:3,title:'تقييم جديد',desc:'أحمد علي قيّم Sony WH-1000XM5 بـ 5 نجوم',type:'review',time:'منذ 3 ساعات',unread:true},
  {id:4,title:'طلبك تم تأكيده',desc:'طلب MacBook Pro تم تأكيده وسيتم التوصيل غداً',type:'order',time:'أمس',unread:false},
  {id:5,title:'تحديث النظام',desc:'تم إضافة ميزة البحث بالصورة الجديدة',type:'system',time:'منذ يومين',unread:false}
];

// ==================== CATEGORIES ====================
function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = categories.map(cat => `
    <div class="category-card ${currentCategory === cat.id ? 'active' : ''}" data-onclick="selectCategory('${cat.id}')">
      <div class="category-icon">${cat.icon}</div>
      <div class="category-name">${cat.name}</div>
    </div>
  `).join('');
}

function selectCategory(catId) {
  currentCategory = catId === currentCategory ? 'all' : catId;
  renderCategories();
  renderProducts();
}

// ==================== BRAND FILTERS ====================
function renderBrandFilters() {
  const row = document.getElementById('filtersRow');
  if (!row) return;
  const allBtn = `<button type="button" class="filter-chip ${currentBrand === 'all' ? 'active' : ''}" data-brand="all" data-onclick="filterBrand('all',this)"><i class="fas fa-filter"></i> الكل</button>`;
  const brandBtns = brands.map(b => `
    <button type="button" class="filter-chip ${currentBrand === b ? 'active' : ''}" data-brand="${b}" data-onclick="filterBrand('${b}',this)">${b}</button>
  `).join('');
  row.innerHTML = allBtn + brandBtns;
}

function filterBrand(brand, btn) {
  currentBrand = brand;
  renderBrandFilters();
  renderProducts();
}

// ==================== PRICE FILTER ====================
function filterPrice(value) {
  currentPrice = parseInt(value);
  document.getElementById('currentPriceRange').textContent = parseInt(value).toLocaleString() + ' ج.م';
  renderProducts();
}

// ==================== SORT ====================
function sortProducts(sortType, btn) {
  currentSort = sortType;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProducts();
}

// ==================== PRODUCTS ====================
/** Returns the Arabic display label for a category id, used by search matching. */
function getCategoryLabel(categoryId) {
  const cat = categories.find(c => c.id === categoryId);
  return cat ? cat.name : '';
}

function getMinPrice(product) {
  if (!product.stores || !product.stores.length) return null;
  return Math.min(...product.stores.map(s => s.price));
}

function getMaxPrice(product) {
  if (!product.stores || !product.stores.length) return null;
  return Math.max(...product.stores.map(s => s.price));
}

/**
 * BUGFIX: several places (product detail header, favorites list, compare
 * view/table, cart, recently-viewed) rendered `product.icon` directly with
 * no fallback. Demo products have an `icon` emoji field, but admin-added
 * products never did - so for any product added through the admin panel,
 * these spots displayed the literal text "undefined" instead of the photo
 * that was actually uploaded for it. This helper picks, in order: the
 * product's real image, its icon emoji, or a generic box emoji.
 */
function getProductVisual(product, size) {
  const img = product.image || (product.images && product.images[0]);
  if (img) {
    return `<img src="${img}" loading="lazy" alt="${product.name || 'صورة المنتج'}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.outerHTML='${(product.icon || '📦').replace(/'/g, "\\'")}'">`;
  }
  return product.icon || '📦';
}

function getFilteredProducts() {
  let filtered = productsData.filter(p => {
    if (currentCategory !== 'all' && p.category !== currentCategory) return false;
    if (currentBrand !== 'all' && p.brand !== currentBrand) return false;
    const minPrice = getMinPrice(p);
    if (minPrice !== null && minPrice > currentPrice) return false;
    return true;
  });

  // BUGFIX: search used to match the product NAME only. Now it also matches
  // brand, category (by its Arabic label), and price - as originally
  // requested ("البحث بالموديل/الماركة/الفئة/السعر"). It also splits the
  // query into words so "iphone 15" matches "iPhone 15 Pro Max" even though
  // that's not a substring match.
  if (searchQuery) {
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    filtered = filtered.filter(p => {
      const minPrice = getMinPrice(p);
      const haystack = [
        p.name, p.brand, getCategoryLabel(p.category),
        minPrice !== null ? String(minPrice) : ''
      ].join(' ').toLowerCase();
      return terms.every(t => haystack.includes(t));
    });
  }

  if (currentSort === 'price-low') {
    filtered.sort((a, b) => (getMinPrice(a) ?? Infinity) - (getMinPrice(b) ?? Infinity));
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => (getMinPrice(b) ?? 0) - (getMinPrice(a) ?? 0));
  } else if (currentSort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }
  // 'best' uses default order

  return filtered;
}

// ==================== STORE BRAND SYSTEM ====================
const STORE_COLORS = {
  'ب.Tech': '#e53935', 'btech': '#e53935', 'B.Tech': '#e53935',
  'Amazon Egypt': '#ff9900', 'Amazon': '#ff9900',
  'Noon': '#feee00', 'noon': '#feee00',
  'Elaraby': '#1a237e', 'elaraby': '#1a237e', 'Elaraby Group': '#1a237e',
  'iStore': '#555555', 'Apple': '#555555',
  'Virgin': '#cc0000', 'Virgin Megastores': '#cc0000',
  'Carrefour': '#003f8d', 'MANGO': '#c8102e',
  'Souq': '#ff9900', '2B': '#0066cc', 'Radio Shack': '#cc0000',
  'Raneen': '#e91e63', 'Jumia': '#f97316'
};

function getStoreColor(name) {
  if (!name) return '#1a73e8';
  const n = name.trim();
  for (const [k, v] of Object.entries(STORE_COLORS)) {
    if (n.toLowerCase().includes(k.toLowerCase())) return v;
  }
  // Generate consistent color from name
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 42%)`;
}

function getStoreAbbr(name) {
  if (!name) return '🏪';
  const specials = {
    'ب.Tech': 'بـ.T', 'btech': 'بـ.T', 'B.Tech': 'بـ.T',
    'Amazon Egypt': 'AMZ', 'Amazon': 'AMZ',
    'Noon': 'NON', 'noon': 'NON',
    'Elaraby Group': 'ELR', 'Elaraby': 'ELR', 'elaraby': 'ELR',
    'iStore': 'iST', 'Apple': 'APL',
    'Virgin Megastores': 'VRG', 'Virgin': 'VRG',
    'Carrefour': 'CRF', 'MANGO': 'MNG',
    'Souq': 'SQ', '2B': '2B', 'Radio Shack': 'RS',
    'Raneen': 'RNN', 'Jumia': 'JMI'
  };
  for (const [k, v] of Object.entries(specials)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  // For Arabic or mixed names, use first 2-3 characters
  const cleanName = name.trim();
  if (cleanName.length <= 3) return cleanName;
  const words = cleanName.split(/[\s\u200c]+/).filter(w => w.length > 0);
  if (words.length >= 2 && /^[a-zA-Z]/.test(words[0]) && /^[a-zA-Z]/.test(words[1])) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3);
}

// ==================== USER REVIEWS SYSTEM ====================
let userReviews = JSON.parse(localStorage.getItem('sa3ry_reviews') || '{}');

function showReviews(productId) {
  const product = getProductById(productId);
  if (!product) return;
  const reviews = userReviews[productId] || [];

  const body = document.getElementById('productDetailBody');
  const reviewsSection = document.getElementById('reviewsSection_' + productId);
  if (reviewsSection) { reviewsSection.remove(); return; }

  const div = document.createElement('div');
  div.id = 'reviewsSection_' + productId;
  div.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:16px';
  div.innerHTML = `
    <h3 style="font-size:15px;font-weight:700;margin-bottom:12px"><i class="fas fa-star" style="color:#ffc107"></i> التقييمات (${reviews.length + product.reviews})</h3>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <div style="flex:1;background:var(--bg-secondary);border-radius:var(--radius);padding:16px;text-align:center">
        <div style="font-size:40px;font-weight:800;color:var(--primary)">${product.rating}</div>
        <div style="color:#ffc107;font-size:18px;margin:4px 0">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5-Math.floor(product.rating))}</div>
        <div style="font-size:12px;color:var(--text-tertiary)">${(reviews.length + product.reviews).toLocaleString()} تقييم</div>
      </div>
      <div style="flex:2">
        ${[5,4,3,2,1].map(s => {
          const cnt = reviews.filter(r=>r.rating===s).length + Math.round(product.reviews * [0.6,0.25,0.1,0.03,0.02][5-s]);
          const pct = Math.round(cnt/(reviews.length+product.reviews)*100)||0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:11px;width:8px;color:var(--text-secondary)">${s}</span>
            <i class="fas fa-star" style="color:#ffc107;font-size:10px"></i>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:#ffc107;border-radius:3px"></div>
            </div>
            <span style="font-size:10px;color:var(--text-tertiary);width:28px">${pct}%</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <!-- Add review form -->
    <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">أضف تقييمك</div>
      <div style="display:flex;gap:4px;margin-bottom:10px" id="starRating_${productId}">
        ${[1,2,3,4,5].map(s=>`<button data-onclick="setReviewStar(${productId},${s})" style="background:none;border:none;font-size:28px;cursor:pointer;transition:transform 0.1s;line-height:1" data-star="${s}">☆</button>`).join('')}
      </div>
      <textarea id="reviewText_${productId}" placeholder="شاركنا رأيك في المنتج..." style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:Cairo,sans-serif;font-size:13px;resize:none;background:var(--card);color:var(--text);min-height:70px;outline:none" rows="3"></textarea>
      <button data-onclick="submitReview(${productId})" style="background:var(--primary);color:white;border:none;border-radius:var(--radius);padding:10px 20px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;width:100%"><i class="fas fa-paper-plane"></i> إرسال التقييم</button>
    </div>
    <!-- Reviews list -->
    <div id="reviewsList_${productId}">
      ${reviews.slice(0,5).map(r=>`
        <div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:32px;height:32px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px">${sanitizeHTML(r.name[0])}</div>
              <div>
                <div style="font-size:13px;font-weight:700">${sanitizeHTML(r.name)}</div>
                <div style="color:#ffc107;font-size:12px">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary)">${sanitizeHTML(r.date)}</div>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin:0">${sanitizeHTML(r.text)}</p>
        </div>
      `).join('')}
      ${reviews.length===0?'<p style="text-align:center;color:var(--text-tertiary);font-size:13px;padding:20px 0">كن أول من يقيّم هذا المنتج!</p>':''}
    </div>
  `;
  if (body) body.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let _selectedStar = {};
function setReviewStar(productId, star) {
  _selectedStar[productId] = star;
  const container = document.getElementById('starRating_' + productId);
  if (!container) return;
  container.querySelectorAll('button').forEach((btn, i) => {
    btn.textContent = i < star ? '★' : '☆';
    btn.style.color = i < star ? '#ffc107' : 'var(--text-tertiary)';
    btn.style.transform = i < star ? 'scale(1.1)' : 'scale(1)';
  });
}

function submitReview(productId) {
  const star = _selectedStar[productId];
  const text = document.getElementById('reviewText_' + productId)?.value.trim();
  if (!star) { showToast('warning', 'تنبيه', 'اختر عدد النجوم أولاً'); return; }
  if (!text || text.length < 5) { showToast('warning', 'تنبيه', 'اكتب تعليقاً (5 أحرف على الأقل)'); return; }
  if (!userReviews[productId]) userReviews[productId] = [];
  const userName = (currentUser && currentUser.name) ? currentUser.name : 'مستخدم ' + Math.floor(Math.random()*1000);
  userReviews[productId].unshift({
    name: userName, rating: star, text: text.substring(0, 300),
    date: new Date().toLocaleDateString('ar-EG'), id: Date.now()
  });
  localStorage.setItem('sa3ry_reviews', JSON.stringify(userReviews));
  // Refresh reviews section
  const sec = document.getElementById('reviewsSection_' + productId);
  if (sec) sec.remove();
  showReviews(productId);
  showToast('success', 'شكراً!', 'تم إضافة تقييمك بنجاح ⭐');
}

// Infinite scroll state
let _currentPage = 1;
const ITEMS_PER_PAGE = 6;
let _allFilteredProducts = [];

function renderProducts(page = 1) {
  const grid = document.getElementById('productsGrid');
  const loading = document.getElementById('loadingProducts');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultsCount');

  if (loading) loading.style.display = 'none';

  _allFilteredProducts = getFilteredProducts();
  _currentPage = page;

  if (count) count.textContent = _allFilteredProducts.length + ' منتج';

  if (_allFilteredProducts.length === 0) {
    if (grid) grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    // Remove load more btn
    const old = document.getElementById('loadMoreBtn');
    if (old) old.remove();
    return;
  }

  if (empty) empty.style.display = 'none';
  if (!grid) return;

  const products = _allFilteredProducts.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = products.length < _allFilteredProducts.length;

  if (page === 1) grid.innerHTML = '';
  
  const newCards = products.slice((page-1)*ITEMS_PER_PAGE).map(p => {
    const minPrice = getMinPrice(p) ?? 0;
    const maxPrice = getMaxPrice(p) ?? 0;
    const savings = maxPrice - minPrice;
    const bestStore = p.stores.reduce((a, b) => a.price < b.price ? a : b);
    const isFav = favorites.includes(p.id);
    const isCompare = compareList.includes(p.id);

    return `
    <div class="product-card" data-onclick="showProductDetail('${p.id}')">
      <div class="product-header">
        <div class="product-image" style="position:relative;overflow:hidden">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:40px">${p.icon}</span>` : `<span style="font-size:40px">${p.icon}</span>`}
      </div>
        <div class="product-info">
          <div class="product-brand"><i class="fas fa-check-circle"></i> ${p.brand}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-rating">
            <span class="stars">${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5 - Math.floor(p.rating))}</span>
            <span>${p.rating} (${p.reviews})</span>
          </div>
        </div>
      </div>
      ${savings > 0 ? `<div class="savings-badge"><i class="fas fa-tag"></i> وفّر ${savings.toLocaleString()} ج.م</div>` : ''}
      <div class="price-comparison">
        ${p.stores.slice(0, 3).map((s, i) => `
          <div class="price-row ${s.price === minPrice ? 'best-price' : ''}">
            <div class="store-info">
              <div class="store-logo" style="background:${getStoreColor(s.name)};color:white;font-size:11px;font-weight:800;letter-spacing:-0.5px">${getStoreAbbr(s.name)}</div>
              <div>
                <div class="store-name">${s.name}</div>
                <div class="store-location"><i class="fas fa-map-marker-alt"></i> ${s.location}</div>
              </div>
            </div>
            <div class="price-tag">
              <span class="price-value ${s.price === minPrice ? '' : ''}">${s.price.toLocaleString()}</span>
              <span class="price-currency">ج.م</span>
              ${s.price === minPrice ? '<span class="best-price-badge">الأفضل</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="product-actions">
        <button type="button" class="btn btn-primary" style="flex:1;font-size:13px;padding:10px" data-onclick="event.stopPropagation();addToCart('${p.id}')"><i class="fas fa-cart-plus"></i> أضف للسلة</button>
        <button type="button" class="share-btn ${isFav ? '' : ''}" data-onclick="event.stopPropagation();toggleFavorite('${p.id}')" title="مفضلة"><i class="fas ${isFav ? 'fa-heart' : 'fa-heart'}" style="color:${isFav ? '#e53935' : ''}"></i></button>
        <button type="button" class="share-btn ${isCompare ? '' : ''}" data-onclick="event.stopPropagation();toggleCompare('${p.id}')" title="قارن"><i class="fas ${isCompare ? 'fa-check' : 'fa-balance-scale'}"></i></button>
      </div>
      <div class="product-actions">
        <button type="button" class="btn btn-text" style="flex:1" data-onclick="event.stopPropagation();showPriceAlert('${p.id}')"><i class="fas fa-bell"></i> تنبيه السعر</button>
        <button type="button" class="btn btn-text" style="flex:1" data-onclick="event.stopPropagation();showContactModal('${p.id}', '${bestStore.name}')"><i class="fas fa-phone"></i> اتصل بالمحل</button>
      </div>
    </div>
    `;
  }).join('');
  grid.innerHTML += newCards;

  // Load more button
  const oldBtn = document.getElementById('loadMoreBtn');
  if (oldBtn) oldBtn.remove();
  // NEW: when the locally-held products run out but Firestore still has more
  // pages (typeof check guards this file working even before firebase.js
  // finishes loading), fetch the next page from Firestore instead of just
  // stopping - this is the pagination the admin/products spec asked for.
  const firestoreHasMore = typeof _hasMoreProducts !== 'undefined' && _hasMoreProducts;
  if (hasMore) {
    const btn = document.createElement('div');
    btn.id = 'loadMoreBtn';
    btn.style.cssText = 'text-align:center;padding:20px 0';
    btn.innerHTML = `<button data-onclick="renderProducts(${page+1})" style="background:var(--primary);color:white;border:none;border-radius:50px;padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer;font-family:Cairo,sans-serif;box-shadow:0 4px 12px rgba(26,115,232,0.3)"><i class="fas fa-chevron-down"></i> تحميل المزيد (${_allFilteredProducts.length - products.length} منتج)</button>`;
    grid.parentElement.appendChild(btn);
  } else if (firestoreHasMore && !searchQuery && currentCategory === 'all' && currentBrand === 'all') {
    // Only offer to fetch more from the server when no client-side filter is
    // active - otherwise "load more" could fetch products that don't even
    // match the current filter, which would be confusing.
    const btn = document.createElement('div');
    btn.id = 'loadMoreBtn';
    btn.style.cssText = 'text-align:center;padding:20px 0';
    btn.innerHTML = `<button id="loadMoreServerBtn" style="background:var(--primary);color:white;border:none;border-radius:50px;padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer;font-family:Cairo,sans-serif;box-shadow:0 4px 12px rgba(26,115,232,0.3)"><i class="fas fa-cloud-download-alt"></i> تحميل المزيد من الخادم</button>`;
    grid.parentElement.appendChild(btn);
    document.getElementById('loadMoreServerBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
      await loadMoreProductsFromFirestore();
      renderProducts(page);
    });
  }
}

function resetFilters() {
  currentCategory = 'all';
  currentBrand = 'all';
  currentPrice = 100000;
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('priceRange').value = 100000;
  document.getElementById('currentPriceRange').textContent = '100,000 ج.م';
  renderCategories();
  renderBrandFilters();
  renderProducts();
}

// ==================== PRODUCT DETAIL ====================
function showProductDetail(productId) {
  const product = getProductById(productId);
  if (!product) return;

  currentProduct = product;
  addToRecentlyViewed(product);

  const minPrice = getMinPrice(product) ?? 0;
  const maxPrice = getMaxPrice(product) ?? 0;
  const savings = maxPrice - minPrice;
  const isFav = favorites.includes(product.id);

  const body = document.getElementById('productDetailBody');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:80px;margin-bottom:12px;height:110px;display:flex;align-items:center;justify-content:center">${getProductVisual(product)}</div>
    ${product.images && product.images.length > 1 ? `<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:16px;padding-bottom:4px">${product.images.map(img => `<img src="${img}" loading="lazy" alt="${product.name} - صورة إضافية" style="width:60px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border)">`).join('')}</div>` : ''}
      <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">${product.name}</h2>
      <div style="color:var(--primary);font-weight:700;font-size:14px"><i class="fas fa-check-circle"></i> ${product.brand}</div>
      <div class="product-rating" style="justify-content:center;margin-top:8px">
        <span class="stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
        <span>${product.rating} (${product.reviews} تقييم)</span>
      </div>
    </div>
    ${savings > 0 ? `<div class="savings-badge" style="width:100%;justify-content:center;margin-bottom:16px"><i class="fas fa-tag"></i> وفّر حتى ${savings.toLocaleString()} ج.م</div>` : ''}
    <h3 style="font-size:16px;font-weight:700;margin-bottom:12px"><i class="fas fa-store"></i> مقارنة الأسعار</h3>
    <div class="price-comparison" style="margin-bottom:16px">
      ${product.stores.map(s => `
        <div class="price-row ${s.price === minPrice ? 'best-price' : ''}">
          <div class="store-info">
            <div class="store-logo" style="background:${getStoreColor(s.name)};color:white;font-size:11px;font-weight:800;letter-spacing:-0.5px">${getStoreAbbr(s.name)}</div>
            <div>
              <div class="store-name">${s.name}</div>
              <div class="store-location"><i class="fas fa-map-marker-alt"></i> ${s.location}</div>
            </div>
          </div>
          <div class="price-tag">
            <span class="price-value" style="font-size:18px">${s.price.toLocaleString()}</span>
            <span class="price-currency">ج.م</span>
            ${s.price === minPrice ? '<span class="best-price-badge">الأفضل</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button type="button" class="btn btn-primary btn-full" data-onclick="addToCart('${product.id}')"><i class="fas fa-cart-plus"></i> أضف للسلة</button>
    </div>
    <div style="display:flex;gap:8px">
      <button type="button" class="btn btn-secondary" style="flex:1" data-onclick="toggleFavorite('${product.id}')"><i class="fas ${isFav ? 'fa-heart' : 'fa-heart'}"></i> ${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}</button>
      <button type="button" class="btn btn-secondary" style="flex:1" data-onclick="toggleCompare('${product.id}')"><i class="fas fa-balance-scale"></i> قارن</button>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button type="button" class="btn btn-text" style="flex:1;background:var(--bg-secondary)" data-onclick="showPriceAlert('${product.id}')"><i class="fas fa-bell"></i> تنبيه السعر</button>
      <button type="button" class="btn btn-text" style="flex:1;background:var(--bg-secondary)" data-onclick="showPriceHistory('${product.id}')"><i class="fas fa-chart-line"></i> تاريخ السعر</button>
    </div>
    <button type="button" style="width:100%;margin-top:10px;background:linear-gradient(135deg,#ffc107,#ff8f00);color:white;border:none;border-radius:var(--radius);padding:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer" data-onclick="showReviews('${product.id}')"><i class="fas fa-star"></i> التقييمات والآراء (${product.reviews.toLocaleString()})</button>
  `;

  openModal('productDetailModal');
}

function shareCurrentProduct() {
  if (!currentProduct) return;
  const shareOptions = document.getElementById('shareOptions');
  shareOptions.innerHTML = `
    <button class="share-option" data-onclick="shareVia('whatsapp')">
      <i class="fab fa-whatsapp" style="background:#25d366"></i>
      <span>واتساب</span>
    </button>
    <button class="share-option" data-onclick="shareVia('facebook')">
      <i class="fab fa-facebook-f" style="background:#1877f2"></i>
      <span>فيسبوك</span>
    </button>
    <button class="share-option" data-onclick="shareVia('twitter')">
      <i class="fab fa-twitter" style="background:#1da1f2"></i>
      <span>تويتر</span>
    </button>
    <button class="share-option" data-onclick="shareVia('copy')">
      <i class="fas fa-link" style="background:var(--primary)"></i>
      <span>نسخ الرابط</span>
    </button>
  `;
  openModal('shareModal');
}

// BUGFIX: shareVia() used to just show a toast saying "opening X" without
// actually opening or copying anything at all - the share feature was
// entirely non-functional. Now it builds a real share message/URL and
// either opens the correct share intent or copies to the clipboard.
function shareVia(platform) {
  if (!currentProduct) { closeModal('shareModal'); return; }

  const minPrice = getMinPrice(currentProduct) ?? 0;
  const productUrl = `${window.location.origin}${window.location.pathname}?product=${currentProduct.id}`;
  const text = `${currentProduct.name} من ${minPrice.toLocaleString()} ج.م - قارن الأسعار على سعري`;

  if (platform === 'copy') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(productUrl)
        .then(() => showToast('success', 'تم!', 'تم نسخ الرابط'))
        .catch(() => showToast('error', 'خطأ', 'تعذر نسخ الرابط'));
    } else {
      // Fallback for browsers/contexts without the Clipboard API (e.g. non-HTTPS).
      const tmp = document.createElement('textarea');
      tmp.value = productUrl;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); showToast('success', 'تم!', 'تم نسخ الرابط'); }
      catch (e) { showToast('error', 'خطأ', 'تعذر نسخ الرابط'); }
      document.body.removeChild(tmp);
    }
  } else if (platform === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + productUrl)}`, '_blank');
  } else if (platform === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
  } else if (platform === 'twitter') {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(productUrl)}`, '_blank');
  }

  closeModal('shareModal');
}

// ==================== CONTACT ====================
function showContactModal(productId, storeName) {
  const product = getProductById(productId);
  if (!product) return;
  const store = product.stores.find(s => s.name === storeName) || product.stores[0];
  currentStore = store;

  document.getElementById('contactStoreInfo').innerHTML = `
    <div class="store-detail-icon" style="background:${getStoreColor(store.name)};color:white;font-weight:800;font-size:16px">${getStoreAbbr(store.name)}</div>
    <div class="store-detail-info">
      <h3>${store.name}</h3>
      <p><i class="fas fa-map-marker-alt"></i> ${store.location}</p>
    </div>
  `;

  document.getElementById('contactButtons').innerHTML = `
    <button type="button" class="contact-btn" style="background:#25d366" data-onclick="contactStore('whatsapp')"><i class="fab fa-whatsapp"></i> واتساب</button>
    <button type="button" class="contact-btn" style="background:var(--primary)" data-onclick="contactStore('phone')"><i class="fas fa-phone"></i> اتصال</button>
    <button type="button" class="contact-btn" style="background:var(--accent)" data-onclick="showMapModal()"><i class="fas fa-map-marker-alt"></i> الموقع على الخريطة</button>
  `;

  openModal('contactModal');
}

function contactStore(type) {
  if (!currentStore) return;
  if (type === 'whatsapp' && currentStore.whatsapp) {
    window.open('https://wa.me/' + currentStore.whatsapp, '_blank');
  } else if (type === 'phone' && currentStore.phone) {
    window.location.href = 'tel:' + currentStore.phone;
  } else {
    showToast('info', 'عذراً', 'رقم التواصل غير متاح');
  }
}

function showMapModal() {
  if (!currentStore) return;
  document.getElementById('mapStoreInfo').innerHTML = `
    <div class="store-detail-icon" style="background:${getStoreColor(currentStore.name)};color:white;font-weight:800;font-size:16px">${getStoreAbbr(currentStore.name)}</div>
    <div class="store-detail-info">
      <h3>${currentStore.name}</h3>
      <p><i class="fas fa-map-marker-alt"></i> ${currentStore.location || 'مصر'}</p>
    </div>
  `;
  const iframe=document.getElementById('mapIframe'),ph=document.getElementById('mapPlaceholder'),hint=document.getElementById('mapAddressHint');
  if(iframe){iframe.style.display='none';iframe.src='';}
  if(ph)ph.style.display='flex';
  if(hint)hint.textContent=currentStore.location||'مصر';
  openModal('mapModal');
}

function loadMapNow() {
  if (!currentStore) return;
  const placeholder = document.getElementById('mapPlaceholder');
  const spinner = document.getElementById('mapLoadingSpinner');
  const iframe = document.getElementById('mapIframe');
  if (!iframe) return;

  if (placeholder) placeholder.style.display = 'none';
  if (spinner) spinner.style.display = 'flex';

  const coords = getStoreCoords(currentStore.name, currentStore.location);
  const searchQ = encodeURIComponent(
    (STORE_SEARCH_TERMS[currentStore.name] || currentStore.name + ' ' + (currentStore.location || 'Cairo') + ' Egypt')
  );
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng-0.05},${coords.lat-0.04},${coords.lng+0.05},${coords.lat+0.04}&layer=mapnik&marker=${coords.lat},${coords.lng}`;

  iframe.src = mapUrl;
  iframe.onload = () => {
    if (spinner) spinner.style.display = 'none';
    iframe.style.display = 'block';
  };
  iframe.onerror = () => {
    if (spinner) spinner.style.display = 'none';
    if (placeholder) { placeholder.style.display = 'flex'; placeholder.innerHTML = '<div style="font-size:32px;margin-bottom:8px">🗺️</div><p style="font-size:13px;color:var(--text-secondary)">تعذر تحميل الخريطة</p><p style="font-size:12px;color:var(--primary);cursor:pointer" data-onclick="openInGoogleMaps()">افتح Google Maps بدلاً</p>'; }
  };
}


// Store coordinates database (Egyptian cities)
const EGYPT_COORDS = {
  'القاهرة': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'الجيزة': { lat: 29.9870, lng: 31.2118, label: 'Giza' },
  'الإسكندرية': { lat: 31.2001, lng: 29.9187, label: 'Alexandria' },
  'أونلاين': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'مصر': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'غير محدد': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'الإسماعيلية': { lat: 30.5965, lng: 32.2715, label: 'Ismailia' },
  'المنصورة': { lat: 31.0409, lng: 31.3785, label: 'Mansoura' },
  'طنطا': { lat: 30.7865, lng: 30.9980, label: 'Tanta' },
  'أسيوط': { lat: 27.1783, lng: 31.1859, label: 'Asyut' },
  'سوهاج': { lat: 26.5590, lng: 31.6967, label: 'Sohag' },
  'الأقصر': { lat: 25.6872, lng: 32.6396, label: 'Luxor' },
  'أسوان': { lat: 24.0889, lng: 32.8998, label: 'Aswan' }
};

// Store name to search query mapping
const STORE_SEARCH_TERMS = {
  'ب.Tech': 'Btech electronics Egypt',
  'btech': 'Btech electronics Egypt',
  'Amazon Egypt': 'amazon egypt warehouse',
  'Noon': 'noon egypt warehouse',
  'Elaraby Group': 'Elaraby group Cairo',
  'iStore': 'istore apple reseller cairo',
  'Virgin Megastores': 'virgin megastore cairo'
};

function getStoreCoords(storeName, location) {
  const loc = location || 'القاهرة';
  for (const [key, coords] of Object.entries(EGYPT_COORDS)) {
    if (loc.includes(key)) return coords;
  }
  return EGYPT_COORDS['القاهرة'];
}

// Store coordinates database (Egyptian cities)



function openInGoogleMaps() {
  if (!currentStore) return;
  const q = encodeURIComponent((currentStore.name + ' ' + (currentStore.location || 'Egypt')).trim());
  window.open('https://maps.google.com/?q=' + q, '_blank');
}

function openDirections() {
  if (!currentStore) return;
  const coords = getStoreCoords(currentStore.name, currentStore.location);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&destination_place_id=${encodeURIComponent(currentStore.name)}`, '_blank');
}

// ==================== PRICE ALERT ====================
function showPriceAlert(productId) {
  if (isGuest) {
    showToast('warning', 'تنبيه', 'سجل دخول لتفعيل تنبيهات الأسعار');
    return;
  }
  const product = getProductById(productId);
  if (!product) return;
  currentProduct = product;
  const minPrice = getMinPrice(product) ?? 0;

  document.getElementById('alertProductName').textContent = product.name;
  document.getElementById('currentProductPrice').textContent = minPrice.toLocaleString();
  document.getElementById('targetPrice').value = Math.floor(minPrice * 0.9);
  if (currentUser) document.getElementById('alertPhone').value = currentUser.phone || '';

  openModal('priceAlertModal');
}

function savePriceAlert() {
  const target = document.getElementById('targetPrice').value;
  const phone = document.getElementById('alertPhone').value;

  if (!target || !phone) {
    showToast('error', 'خطأ', 'يرجى ملء جميع الحقول');
    return;
  }

  priceAlerts.push({
    productId: currentProduct.id,
    productName: currentProduct.name,
    targetPrice: parseInt(target),
    phone: phone,
    date: new Date().toISOString()
  });

  localStorage.setItem('sa3ry_alerts', JSON.stringify(priceAlerts));
  updateProfileStats();
  closeModal('priceAlertModal');
  showToast('success', 'تم!', 'تم تفعيل تنبيه السعر');
}

// ==================== PRICE HISTORY ====================
function showPriceHistory(productId) {
  const product = getProductById(productId);
  if (!product) return;
  const minPrice = getMinPrice(product) ?? 0;
  const maxPrice = getMaxPrice(product) ?? 0;
  const avgPrice = Math.round(product.stores.reduce((a, s) => a + s.price, 0) / product.stores.length);
  const priceDrop = Math.round((maxPrice - minPrice) / maxPrice * 100);

  document.getElementById('priceStats').innerHTML = `
    <div class="stat-card"><div class="stat-value" style="font-size:16px">${minPrice.toLocaleString()}</div><div class="stat-label">أقل سعر</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:16px">${avgPrice.toLocaleString()}</div><div class="stat-label">متوسط</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:16px">${maxPrice.toLocaleString()}</div><div class="stat-label">أعلى سعر</div></div>
  `;

  const trendColor = priceDrop > 0 ? 'var(--secondary)' : 'var(--danger)';
  const trendIcon = priceDrop > 0 ? 'fa-arrow-down' : 'fa-arrow-up';
  document.getElementById('priceTrend').innerHTML = `
    <i class="fas ${trendIcon}"></i> ${priceDrop > 0 ? 'السعر انخفض ' + priceDrop + '% عن أعلى سعر مسجل' : 'السعر مستقر عبر المتاجر'}
  `;

  openModal('priceHistoryModal');

  // Draw charts after modal opens
  setTimeout(() => {
    drawPriceComparisonChart(product);
    drawPriceHistoryChart(product, minPrice, maxPrice);
  }, 150);
}


// roundRect polyfill for older browsers (Safari < 16)
if (CanvasRenderingContext2D.prototype.roundRect === undefined) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

function drawPriceComparisonChart(product) {
  const canvas = document.getElementById('priceChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth || 300;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = 180 * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  canvas.style.width = w + 'px';
  canvas.style.height = '180px';

  const isDark = document.body.classList.contains('dark-mode');
  const stores = product.stores.slice(0, 5);
  const prices = stores.map(s => s.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const padding = { top: 20, right: 16, bottom: 50, left: 16 };
  const chartW = w - padding.left - padding.right;
  const chartH = 180 - padding.top - padding.bottom;
  const barW = Math.floor(chartW / stores.length) - 8;

  ctx.clearRect(0, 0, w, 180);

  stores.forEach((s, i) => {
    const barH = Math.max(20, ((s.price - minP * 0.95) / (maxP * 1.05 - minP * 0.95)) * chartH);
    const x = padding.left + i * (chartW / stores.length) + 4;
    const y = padding.top + chartH - barH;
    const isMin = s.price === minP;

    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    if (isMin) {
      grad.addColorStop(0, '#00e676');
      grad.addColorStop(1, '#00c853');
    } else {
      grad.addColorStop(0, '#42a5f5');
      grad.addColorStop(1, '#1a73e8');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
    ctx.fill();

    // Price label on bar
    ctx.fillStyle = isDark ? '#fff' : '#1a1a2e';
    ctx.font = `bold ${Math.min(11, 10)}px Cairo, sans-serif`;
    ctx.textAlign = 'center';
    const label = s.price >= 1000 ? (s.price/1000).toFixed(1)+'k' : s.price.toLocaleString();
    ctx.fillText(label, x + barW/2, y - 6);

    // Store name below
    ctx.fillStyle = isDark ? '#b0b0b0' : '#5f6368';
    ctx.font = '9px Cairo, sans-serif';
    const name = s.name.length > 7 ? s.name.substring(0,7)+'.' : s.name;
    ctx.fillText(name, x + barW/2, padding.top + chartH + 16);

    // Best badge
    if (isMin) {
      ctx.fillStyle = '#00c853';
      ctx.font = 'bold 8px Cairo, sans-serif';
      ctx.fillText('✓ الأفضل', x + barW/2, padding.top + chartH + 28);
    }
  });
}

function drawPriceHistoryChart(product, minPrice, maxPrice) {
  const canvas = document.getElementById('priceHistoryCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth || 300;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = 120 * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  canvas.style.width = w + 'px';
  canvas.style.height = '120px';

  const isDark = document.body.classList.contains('dark-mode');

  // Generate simulated price history (last 6 months)
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو'];
  const now = Date.now();
  const seed = product.id;
  const history = months.map((m, i) => {
    const factor = 1 + (Math.sin(i * 2.1 + (typeof seed === 'number' ? seed : 1)) * 0.08);
    return Math.round(maxPrice * factor * (1 - i * 0.02));
  });
  history.push(minPrice);

  const allMonths = [...months, 'الآن'];
  const maxH = Math.max(...history);
  const minH = Math.min(...history) * 0.95;
  const padding = { top: 16, right: 16, bottom: 32, left: 20 };
  const chartW = w - padding.left - padding.right;
  const chartH = 120 - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, 120);

  // Grid lines
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padding.top + (chartH / 3) * i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
  }

  // Line path
  const points = history.map((p, i) => ({
    x: padding.left + (i / (history.length - 1)) * chartW,
    y: padding.top + chartH - ((p - minH) / (maxH - minH)) * chartH
  }));

  // Fill area
  const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  grad.addColorStop(0, 'rgba(26,115,232,0.3)');
  grad.addColorStop(1, 'rgba(26,115,232,0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length-1].x, padding.top + chartH);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Dots
  points.forEach((p, i) => {
    const isLast = i === points.length - 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isLast ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isLast ? '#00c853' : '#1a73e8';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Month labels
  ctx.fillStyle = isDark ? '#808080' : '#9aa0a6';
  ctx.font = '9px Cairo, sans-serif';
  ctx.textAlign = 'center';
  allMonths.forEach((m, i) => {
    const x = padding.left + (i / (allMonths.length - 1)) * chartW;
    ctx.fillText(m, x, 120 - 6);
  });
}

// ==================== FAVORITES ====================
function toggleFavorite(productId) {
  const strId = normalizeId(productId);
  const idx = favorites.findIndex(id => normalizeId(id) === strId);
  if (idx > -1) {
    favorites.splice(idx, 1);
    showToast('info', 'تم', 'تم إزالة المنتج من المفضلة');
    // NEW: the IndexedDB 'favorites' store existed in the schema but was
    // never actually written to or read from - favorites only worked
    // online via localStorage. Keeping it in sync means favorited products
    // stay browsable offline too, consistent with the rest of the app.
    idbDelete('favorites', strId).catch(() => {});
  } else {
    favorites.push(productId);
    showToast('success', 'تم!', 'تم إضافة المنتج للمفضلة');
    const product = getProductById(productId);
    if (product) idbSave('favorites', { ...product, id: strId }).catch(() => {});
  }
  localStorage.setItem('sa3ry_favorites', JSON.stringify(favorites));
  renderProducts();
  updateProfileStats();
}

function showFavorites() {
  closeModal('profileModal');
  const body = document.getElementById('favoritesBody');
  if (favorites.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❤️</div>
        <div class="empty-title">لا توجد مفضلات</div>
        <div class="empty-desc">أضف منتجات للمفضلة لتظهر هنا</div>
      </div>
    `;
  } else {
    body.innerHTML = favorites.map(fid => {
      const p = getProductById(fid);
      if (!p) return '';
      const minPrice = getMinPrice(p) ?? 0;
      return `
        <div class="fav-item" data-onclick="showProductDetail('${p.id}')">
          <div class="fav-item-image">${getProductVisual(p)}</div>
          <div class="fav-item-info">
            <div class="fav-item-name">${p.name}</div>
            <div class="fav-item-price">${minPrice.toLocaleString()} ج.م</div>
          </div>
          <button class="fav-item-remove" data-onclick="event.stopPropagation();toggleFavorite('${p.id}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
    }).join('');
  }
  openModal('favoritesModal');
}

// ==================== COMPARE ====================
function toggleCompare(productId) {
  const strId = normalizeId(productId);
  const idx = compareList.findIndex(id => normalizeId(id) === strId);
  if (idx > -1) {
    compareList.splice(idx, 1);
  } else {
    if (compareList.length >= 3) {
      showToast('warning', 'تنبيه', 'يمكن مقارنة 3 منتجات فقط');
      return;
    }
    compareList.push(productId);
  }
  updateCompareBar();
  renderProducts();
}

function updateCompareBar() {
  const bar = document.getElementById('compareBar');
  const count = document.getElementById('compareCount');
  const items = document.getElementById('compareItems');

  count.textContent = compareList.length;

  if (compareList.length === 0) {
    bar.classList.remove('active');
    return;
  }

  bar.classList.add('active');
  items.innerHTML = compareList.map(cid => {
    const p = getProductById(cid);
    if (!p) return '';
    return `
      <div class="compare-item">
        <button class="compare-item-remove" data-onclick="toggleCompare('${p.id}')"><i class="fas fa-times"></i></button>
        <div class="compare-item-icon">${getProductVisual(p)}</div>
        <div class="compare-item-name">${p.name}</div>
      </div>
    `;
  }).join('');
}

function clearCompare() {
  compareList = [];
  updateCompareBar();
  renderProducts();
}

function openComparePage() {
  if (compareList.length < 2) {
    showToast('warning', 'تنبيه', 'اختر منتجين على الأقل للمقارنة');
    return;
  }

  const products = compareList.map(cid => getProductById(cid)).filter(Boolean);
  const body = document.getElementById('comparePageBody');

  body.innerHTML = `
    <table class="compare-table">
      <tr><th>المنتج</th>${products.map(p => `<th>${getProductVisual(p)}<br>${p.name}</th>`).join('')}</tr>
      <tr><td>العلامة التجارية</td>${products.map(p => `<td>${p.brand}</td>`).join('')}</tr>
      <tr><td>التقييم</td>${products.map(p => `<td>${p.rating} ★</td>`).join('')}</tr>
      <tr><td>أقل سعر</td>${products.map(p => {
        const minP = getMinPrice(p) ?? 0;
        const winner = products.every(other => {
          if (other === p) return true;
          return minP <= (getMinPrice(other) ?? Infinity);
        });
        return `<td class="${winner ? 'compare-winner' : ''}">${minP.toLocaleString()} ج.م</td>`;
      }).join('')}</tr>
      <tr><td>أعلى سعر</td>${products.map(p => `<td>${(getMaxPrice(p) ?? 0).toLocaleString()} ج.م</td>`).join('')}</tr>
      <tr><td>عدد المتاجر</td>${products.map(p => `<td>${p.stores.length} متاجر</td>`).join('')}</tr>
      <tr><td>الإجراء</td>${products.map(p => `<td><button class="btn btn-primary" style="font-size:12px;padding:8px" data-onclick="addToCart('${p.id}');closeModal('comparePageModal')">أضف للسلة</button></td>`).join('')}</tr>
    </table>
  `;

  closeModal('productDetailModal');
  openModal('comparePageModal');
}

// ==================== CART ====================
function addToCart(productId) {
  const strId = normalizeId(productId);
  const existing = cart.find(item => normalizeId(item.id) === strId);
  if (existing) {
    existing.qty++;
  } else {
    const product = getProductById(productId);
    if (!product) return;
    const bestStore = product.stores.reduce((a, b) => a.price < b.price ? a : b);
    cart.push({id: productId, qty: 1, store: bestStore.name, price: bestStore.price});
  }
  localStorage.setItem('sa3ry_cart', JSON.stringify(cart));
  updateCartBadge();
  showToast('success', 'تم!', 'تم إضافة المنتج للسلة');
}

function removeFromCart(productId) {
  const strId = normalizeId(productId);
  cart = cart.filter(item => normalizeId(item.id) !== strId);
  localStorage.setItem('sa3ry_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

function updateCartQty(productId, delta) {
  const strId = normalizeId(productId);
  const item = cart.find(i => normalizeId(i.id) === strId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(productId);
    return;
  }
  localStorage.setItem('sa3ry_cart', JSON.stringify(cart));
  renderCart();
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const total = cart.reduce((a, item) => a + item.qty, 0);
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

function renderCart() {
  const list = document.getElementById('cartItemsList');
  const summary = document.getElementById('cartSummary');

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <div class="empty-title">السلة فارغة</div>
        <div class="empty-desc">أضف منتجات للسلة لتظهر هنا</div>
      </div>
    `;
    summary.style.display = 'none';
    return;
  }

  summary.style.display = 'block';
  let total = 0;

  list.innerHTML = cart.map(item => {
    const product = getProductById(item.id);
    if (!product) return '';
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-image">${getProductVisual(product)}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${product.name}</div>
          <div class="cart-item-store">${item.store}</div>
          <div class="cart-item-price">${itemTotal.toLocaleString()} ج.م</div>
          <div class="cart-item-actions">
            <button class="qty-btn" data-onclick="updateCartQty('${item.id}', -1)">-</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-onclick="updateCartQty('${item.id}', 1)">+</button>
            <button class="btn btn-text" style="color:var(--danger);margin-right:auto" data-onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  summary.innerHTML = `
    <div class="cart-total-row"><span>المجموع الفرعي</span><span>${total.toLocaleString()} ج.م</span></div>
    <div class="cart-total-row"><span>الشحن</span><span>مجاني</span></div>
    <div class="cart-total-final"><span>الإجمالي</span><span>${total.toLocaleString()} ج.م</span></div>
    <button type="button" class="btn btn-success btn-full" style="margin-top:16px" data-onclick="checkout()"><i class="fas fa-credit-card"></i> إتمام الشراء</button>
  `;
}

function checkout() {
  showToast('success', 'تم!', 'تم إرسال طلبك بنجاح');
  cart = [];
  localStorage.setItem('sa3ry_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
  closeModal('cartModal');
}

// ==================== RECENTLY VIEWED ====================
function addToRecentlyViewed(product) {
  recentlyViewed = recentlyViewed.filter(p => p.id !== product.id);
  recentlyViewed.unshift({id: product.id, name: product.name, icon: product.icon, image: product.image, price: getMinPrice(product) ?? 0});
  if (recentlyViewed.length > 10) recentlyViewed.pop();
  localStorage.setItem('sa3ry_recent', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const section = document.getElementById('recentlyViewedSection');
  const list = document.getElementById('recentlyViewedList');
  if (!section || !list) return;

  if (recentlyViewed.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = recentlyViewed.map(p => `
    <div class="recent-item" data-onclick="showProductDetail('${p.id}')">
      <div class="recent-item-image">${getProductVisual(p)}</div>
      <div class="recent-item-name">${p.name}</div>
    </div>
  `).join('');
}

// ==================== GOOGLE PRICE SEARCH ====================
const VERCEL_API = 'https://sa3ry-server.vercel.app/api/prices';

async function searchRealPrices(productName) {
  try {
    const url = `${VERCEL_API}?q=${encodeURIComponent(productName)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  } catch(e) {
    console.error('Price search error:', e);
    return [];
  }
}

async function autoFillPrices() {
  const name = document.getElementById('adminProductName').value.trim();
  if (!name) {
    showToast('error', 'خطأ', 'اكتب اسم المنتج الأول');
    return;
  }

  showLoading('جاري البحث عن الأسعار...');

  const results = await searchRealPrices(name);
  hideLoading();

  if (results.length === 0) {
    showToast('error', 'للأسف', 'مش لاقي أسعار، ضيفها يدوياً');
    return;
  }

  // Clear existing stores
  document.getElementById('adminStores').innerHTML = '';

  // Add found stores
  results.forEach(r => {
    addStoreField();
    const stores = document.getElementById('adminStores');
    const lastStore = stores.lastElementChild;
    lastStore.querySelector('.store-name').value = r.store;
    lastStore.querySelector('.store-price').value = r.price;
    lastStore.querySelector('.store-location').value = 'مصر';
  });

  showToast('success', 'تم!', `لقينا ${results.length} محل بأسعار حقيقية! 🎉`);
}
async function importFromExcel(input) {
  const file = input.files[0];
  if (!file) return;

  showLoading('جاري قراءة ملف Excel...');

  // Load SheetJS if not loaded
  if (typeof XLSX === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Skip first 3 rows (title, subtitle, headers)
      const dataRows = rows.slice(3).filter(row => row[0] && row[5] && row[6]);

      if (dataRows.length === 0) {
        hideLoading();
        showToast('error', 'خطأ', 'مفيش بيانات في الملف');
        return;
      }

      // Group rows by product name
      const productsMap = {};
      dataRows.forEach(row => {
        const name = String(row[0]).trim();
        const brand = String(row[1]).trim();
        const category = String(row[2]).trim();
        const description = String(row[3]).trim();
        const rating = parseFloat(row[4]) || 4.5;
        const storeName = String(row[5]).trim();
        const price = parseInt(row[6]) || 0;
        const location = String(row[7]).trim() || 'غير محدد';
        const phone = String(row[8]).trim() || '';
        const whatsapp = String(row[9]).trim() || '';
        const link = String(row[10]).trim() || '';
        const image = String(row[11]).trim() || '';
        const available = String(row[12]).trim() !== 'لا';

        if (!name || !storeName || !price) return;

        const catMap = {
          'موبايلات': 'phones', 'لابتوبات': 'laptops', 'تليفزيونات': 'tvs',
          'تابلت': 'tablets', 'سماعات': 'accessories', 'كاميرات': 'cameras',
          'أجهزة منزلية': 'appliances', 'إكسسوارات': 'accessories'
        };

        if (!productsMap[name]) {
          productsMap[name] = { name, brand, category: catMap[category] || 'phones', description, rating, reviews: 0, image, stores: [] };
        }

        if (available) {
          productsMap[name].stores.push({ name: storeName, price, location, phone, whatsapp, link });
        }
      });

      const products = Object.values(productsMap).filter(p => p.stores.length > 0);

      if (products.length === 0) {
        hideLoading();
        showToast('error', 'خطأ', 'مفيش منتجات صح في الملف');
        return;
      }

      // Add all products to Firestore
      let added = 0;
      for (const product of products) {
        try {
          const id = await addProductToFirestore(product);
          product.id = id;
          productsData.unshift(product);
          added++;
        } catch(e) {
          console.error('Error adding product:', product.name, e);
        }
      }

      renderProducts();
      renderAdminProducts();
      hideLoading();
      showToast('success', 'تم!', `تم إضافة ${added} منتج بنجاح! 🎉`);

    } catch(e) {
      hideLoading();
      console.error(e);
      showToast('error', 'خطأ', 'فشل قراءة الملف - تأكد إنه Excel صح');
    }
  };
  reader.readAsArrayBuffer(file);
}

