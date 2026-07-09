// ==================== ADMIN.JS ====================
// Admin panel UI + Cloudinary image upload.
// SECURITY: every entry point here re-checks isAdminUser (set by firebase.js
// after verifying /admins/{uid} in Firestore). Firestore Rules are the real
// enforcement layer - these checks just keep the UI honest and give fast,
// friendly feedback instead of a silent Firestore permission-denied error.
'use strict';

// ==================== ADMIN PANEL ====================
function openAdminPanel() {
  if (!currentUser) {
    showToast('error', 'خطأ', 'سجل دخول أولاً');
    return;
  }
  // SECURITY FIX: previously ANY logged-in user could open the admin panel
  // and add/edit/delete products. Now we require a verified admin doc in
  // Firestore (/admins/{uid}) before showing any admin UI.
  if (!isAdminUser) {
    showToast('error', 'غير مصرح', 'هذه الصفحة مخصصة للإدارة فقط');
    return;
  }
  openModal('adminModal');
  // Add initial store field if empty
  const stores = document.getElementById('adminStores');
  if (stores && stores.children.length === 0) addStoreField();
  renderBrandsDatalist();
  renderAdminProducts();
  updateProductPreview();
}

/** NEW: brand autocomplete - suggests brands already used by existing products. */
function renderBrandsDatalist() {
  const datalist = document.getElementById('brandsDatalist');
  if (!datalist) return;
  const brands = [...new Set(productsData.map(p => p.brand).filter(Boolean))].sort();
  datalist.innerHTML = brands.map(b => `<option value="${sanitizeHTML(b)}">`).join('');
}

// ==================== CLOUDINARY IMAGE UPLOAD ====================
// Global Cloudinary config
const CLOUDINARY_CLOUD = 'drdcmtubh';
const CLOUDINARY_PRESET = 'ts5e7ktl';
const CLOUDINARY_MAX_RETRIES = 2;

async function uploadToCloudinary(file, attempt = 1) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.secure_url) throw new Error('no secure_url in response');
    return data;
  } catch (e) {
    // NEW: retry on failure (e.g. flaky mobile connection) with a short
    // backoff, instead of giving up on the first network hiccup.
    if (attempt <= CLOUDINARY_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, attempt * 800));
      return uploadToCloudinary(file, attempt + 1);
    }
    throw e;
  }
}

// NEW: holds the uploaded image URLs for the product currently being
// added/edited. First image is treated as the "main" image (product.image,
// kept for backward compatibility with anything that only reads a single
// image); the full list is saved as product.images.
let currentAdminImages = [];

async function handleImageUpload(fileList) {
  const files = Array.from(fileList || []).filter(f => f.size <= 5 * 1024 * 1024);
  const rejected = fileList.length - files.length;
  if (rejected > 0) showToast('error', 'خطأ', `${rejected} صورة تجاوزت حجم 5MB واتجاهلت`);
  if (!files.length) return;

  document.getElementById('imageUploadPlaceholder').style.display = 'none';
  document.getElementById('imageUploadProgress').style.display = 'block';
  document.getElementById('imageUploadStatusText').textContent = `جاري رفع ${files.length} صورة...`;

  let done = 0;
  for (const file of files) {
    document.getElementById('progressBar').style.width = Math.round((done / files.length) * 100) + '%';
    try {
      const compressed = await compressImage(file);
      const data = await uploadToCloudinary(compressed);
      currentAdminImages.push(data.secure_url);
    } catch (e) {
      showToast('error', 'خطأ', `فشل رفع صورة: ${file.name}`);
    }
    done++;
    document.getElementById('progressBar').style.width = Math.round((done / files.length) * 100) + '%';
  }

  document.getElementById('imageUploadProgress').style.display = 'none';
  renderImagePreviewGrid();
  if (currentAdminImages.length) showToast('success', 'تم!', 'تم رفع الصور بنجاح');
  updateProductPreview();
}

/** Renders the thumbnail grid of all uploaded images, each with a remove (×) button. */
function renderImagePreviewGrid() {
  const grid = document.getElementById('imagePreviewGrid');
  const container = document.getElementById('imagePreviewContainer');
  const placeholder = document.getElementById('imageUploadPlaceholder');
  document.getElementById('adminImageUrl').value = currentAdminImages[0] || '';

  if (!currentAdminImages.length) {
    container.style.display = 'none';
    placeholder.style.display = 'block';
    return;
  }
  placeholder.style.display = 'none';
  container.style.display = 'block';
  document.getElementById('imageUploadCountLabel').textContent = `تم رفع ${currentAdminImages.length} صورة`;
  grid.innerHTML = currentAdminImages.map((url, i) => `
    <div style="position:relative">
      <img src="${url}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;${i === 0 ? 'outline:2px solid var(--primary)' : ''}">
      ${i === 0 ? '<span style="position:absolute;bottom:2px;right:2px;background:var(--primary);color:#fff;font-size:9px;padding:1px 5px;border-radius:4px">رئيسية</span>' : ''}
      <button type="button" onclick="event.stopPropagation();removeAdminImage(${i})" style="position:absolute;top:-6px;left:-6px;width:20px;height:20px;border-radius:50%;background:var(--danger);color:#fff;border:none;font-size:11px;cursor:pointer;line-height:1">×</button>
    </div>
  `).join('');
}

function removeAdminImage(index) {
  currentAdminImages.splice(index, 1);
  renderImagePreviewGrid();
  updateProductPreview();
}

/** Drag-and-drop wiring for the upload zone. Runs once at script load since
 *  these elements are already in the DOM by the time this (body-end) script runs. */
(function setupImageDragDrop() {
  const area = document.getElementById('imageUploadArea');
  if (!area) return;
  ['dragover', 'dragenter'].forEach(evt => area.addEventListener(evt, (e) => {
    e.preventDefault();
    area.style.background = 'var(--primary-light)';
  }));
  ['dragleave', 'dragend'].forEach(evt => area.addEventListener(evt, () => {
    area.style.background = 'var(--bg-secondary)';
  }));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.background = 'var(--bg-secondary)';
    if (e.dataTransfer?.files?.length) handleImageUpload(e.dataTransfer.files);
  });
})();

function addStoreField() {
  const container = document.getElementById('adminStores');
  const idx = container.children.length + 1;
  const storeDiv = document.createElement('div');
  storeDiv.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px';

  // NEW: pick the store from the `stores` collection instead of typing its
  // name by hand each time. Falls back to a text field with a friendly
  // notice if no stores have been added yet in "إدارة المتاجر".
  const storeOptions = storesData.filter(s => s.active !== false)
    .map(s => `<option value="${s.id}">${sanitizeHTML(s.name)}</option>`).join('');

  storeDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-weight:700;font-size:13px;color:var(--primary)"><i class="fas fa-store"></i> محل #${idx}</span>
      <button data-onclick="this.closest('div[style]').remove();updateProductPreview()" style="background:var(--danger);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px"><i class="fas fa-trash"></i></button>
    </div>
    ${storesData.length ? `
    <select class="form-input store-select" style="font-size:13px;margin-bottom:8px" onchange="updateProductPreview()">
      <option value="">اختار المتجر...</option>
      ${storeOptions}
    </select>` : `
    <div style="background:var(--warning);color:#5c3c00;font-size:11px;padding:8px 10px;border-radius:8px;margin-bottom:8px">
      <i class="fas fa-info-circle"></i> مفيش متاجر مضافة لسه. <a href="#" onclick="event.preventDefault();openStoresManagement()" style="color:#5c3c00;font-weight:700;text-decoration:underline">أضف متجر من هنا</a> أو اكتب الاسم يدوياً تحت:
    </div>
    <input type="text" class="form-input store-name-manual" placeholder="اسم المحل (بي تك، نون...)" style="font-size:13px;margin-bottom:8px">
    `}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <input type="number" class="form-input store-price" placeholder="السعر بالجنيه" style="font-size:13px" oninput="updateProductPreview()">
      <input type="number" class="form-input store-quantity" placeholder="الكمية (اختياري)" style="font-size:13px" min="0">
    </div>
    <input type="url" class="form-input store-link" placeholder="رابط المنتج في المتجر (اختياري)" style="font-size:13px">`;
  container.appendChild(storeDiv);
  updateProductPreview();
}

// NEW: tracks which admin-added products are checked for bulk actions.
let selectedAdminProductIds = new Set();

function renderAdminProducts() {
  const list = document.getElementById('adminProductsList');
  if (!list) return;
  const firestoreProducts = productsData.filter(p => {
    const idStr = normalizeId(p.id);
    return idStr.length > 5 && !/^[0-9]+$/.test(idStr);  // Firestore IDs are alphanumeric, not pure numbers
  });
  const totalStores = productsData.reduce((sum, p) => sum + (p.stores ? p.stores.length : 0), 0);
  const el1 = document.getElementById('adminStatTotal');
  const el2 = document.getElementById('adminStatFirestore');
  const el3 = document.getElementById('adminStatStores');
  if (el1) el1.textContent = productsData.length;
  if (el2) el2.textContent = firestoreProducts.length;
  if (el3) el3.textContent = totalStores;

  renderAdminStats();

  // NEW: search + category filter, scoped to the admin's own products list.
  const searchTerm = (document.getElementById('adminSearchInput')?.value || '').trim().toLowerCase();
  const filterCategory = document.getElementById('adminFilterCategory')?.value || 'all';
  const visibleProducts = firestoreProducts.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (searchTerm && !`${p.name} ${p.brand}`.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  if (firestoreProducts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary)"><i class="fas fa-box-open" style="font-size:40px;margin-bottom:10px;display:block;opacity:0.4"></i><p>لا توجد منتجات مضافة بعد</p></div>`;
    return;
  }
  if (visibleProducts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary)"><i class="fas fa-search" style="font-size:32px;margin-bottom:10px;display:block;opacity:0.4"></i><p>مفيش نتائج مطابقة</p></div>`;
    return;
  }
  list.innerHTML = visibleProducts.map(p => {
    const minPrice = getMinPrice(p) ?? 0;
    const pid = normalizeId(p.id);
    const checked = selectedAdminProductIds.has(pid) ? 'checked' : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--bg-secondary)">
      <input type="checkbox" class="admin-product-checkbox" data-id="${pid}" ${checked} onchange="toggleSelectProduct('${pid}', this.checked)" style="flex-shrink:0;width:16px;height:16px">
      ${p.image ? `<img src="${p.image}" loading="lazy" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0">` : `<div style="width:56px;height:56px;background:var(--bg-tertiary);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📦</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">${p.brand} • ${p.stores ? p.stores.length : 0} محلات${p.images && p.images.length > 1 ? ` • ${p.images.length} صور` : ''}</div>
        <div style="font-size:13px;color:var(--primary);font-weight:700;margin-top:4px">من ${minPrice.toLocaleString()} ج.م</div>
      </div>
      <button data-onclick="editProduct('${p.id}')" style="background:rgba(26,115,232,0.1);color:var(--primary);border:1px solid rgba(26,115,232,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-pen"></i></button>
      <button data-onclick="deleteProduct('${p.id}')" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');
}

function toggleSelectProduct(id, checked) {
  if (checked) selectedAdminProductIds.add(id); else selectedAdminProductIds.delete(id);
  const bulkBar = document.getElementById('adminBulkActions');
  if (bulkBar) bulkBar.style.display = selectedAdminProductIds.size > 0 ? 'flex' : 'none';
}

function toggleSelectAllProducts(checked) {
  document.querySelectorAll('.admin-product-checkbox').forEach(cb => {
    cb.checked = checked;
    toggleSelectProduct(cb.dataset.id, checked);
  });
}

/** NEW: bulk-edit - apply one category to every selected product at once. */
async function applyBulkCategory() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  const category = document.getElementById('adminBulkCategory').value;
  if (!category) { showToast('error', 'خطأ', 'اختار فئة الأول'); return; }
  if (selectedAdminProductIds.size === 0) return;

  showLoading(`جاري تحديث ${selectedAdminProductIds.size} منتج...`);
  try {
    for (const id of selectedAdminProductIds) {
      await updateProductInFirestore(id, { category });
      const p = getProductById(id);
      if (p) p.category = category;
    }
    selectedAdminProductIds.clear();
    renderProducts();
    renderAdminProducts();
    document.getElementById('adminBulkActions').style.display = 'none';
    document.getElementById('adminSelectAll').checked = false;
    showToast('success', 'تم!', 'اتحدثت الفئة للمنتجات المحددة');
  } catch (e) {
    showToast('error', 'خطأ', 'فشل التحديث الجماعي: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

/** NEW: bulk-delete selected products. */
async function deleteSelectedProducts() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  if (selectedAdminProductIds.size === 0) return;
  if (!confirm(`هتحذف ${selectedAdminProductIds.size} منتج، متأكد؟`)) return;

  showLoading('جاري الحذف...');
  try {
    for (const id of selectedAdminProductIds) {
      await deleteProductFromFirestore(id);
      productsData = productsData.filter(p => normalizeId(p.id) !== id);
    }
    selectedAdminProductIds.clear();
    renderProducts();
    renderAdminProducts();
    document.getElementById('adminBulkActions').style.display = 'none';
    document.getElementById('adminSelectAll').checked = false;
    showToast('success', 'تم!', 'اتحذفت المنتجات المحددة');
  } catch (e) {
    showToast('error', 'خطأ', 'فشل الحذف الجماعي: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

// NEW: Statistics dashboard - category breakdown, average price, and top
// brand. Uses simple text/bar rows (same visual language as the rest of the
// admin panel) rather than pulling in a charting library, consistent with
// the hand-rolled canvas charts already used for price history elsewhere.
function renderAdminStats() {
  const container = document.getElementById('adminStatsDashboard');
  if (!container || !productsData.length) {
    if (container) container.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:10px">لا توجد بيانات كافية</p>';
    return;
  }

  const byCategory = {};
  let priceSum = 0, priceCount = 0;
  const byBrand = {};

  productsData.forEach(p => {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    byBrand[p.brand] = (byBrand[p.brand] || 0) + 1;
    const minPrice = getMinPrice(p);
    if (minPrice !== null) { priceSum += minPrice; priceCount++; }
  });

  const avgPrice = priceCount ? Math.round(priceSum / priceCount) : 0;
  const topBrand = Object.entries(byBrand).sort((a, b) => b[1] - a[1])[0];
  const maxCategoryCount = Math.max(...Object.values(byCategory));

  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, count]) => {
      const pct = Math.round((count / maxCategoryCount) * 100);
      const label = getCategoryLabel(catId) || catId;
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:700">${label}</span><span style="color:var(--text-tertiary)">${count}</span>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:6px;height:8px;overflow:hidden">
          <div style="background:var(--primary);height:100%;width:${pct}%;border-radius:6px"></div>
        </div>
      </div>`;
    }).join('');

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--primary)">${avgPrice.toLocaleString()} ج.م</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">متوسط السعر</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--primary)">${topBrand ? topBrand[0] : '-'}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">أكثر ماركة</div>
      </div>
    </div>
    ${categoryRows}
  `;
}


// NEW: tracks whether the admin form is in "add" or "edit" mode.
let editingProductId = null;

async function deleteProduct(productId) {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  if (!confirm('هتحذف المنتج ده؟')) return;
  try {
    await deleteProductFromFirestore(productId);
    productsData = productsData.filter(p => normalizeId(p.id) !== normalizeId(productId));
    renderProducts();
    renderAdminProducts();
    showToast('success', 'تم!', 'تم حذف المنتج');
  } catch(e) {
    showToast('error', 'خطأ', 'فشل حذف المنتج: ' + (e.message || ''));
  }
}

/** NEW: populates the admin form with an existing product so it can be edited and re-saved.
 *  Product editing was requested but did not exist anywhere in the previous codebase. */
function editProduct(productId) {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  const product = productsData.find(p => normalizeId(p.id) === normalizeId(productId));
  if (!product) { showToast('error', 'خطأ', 'المنتج غير موجود'); return; }

  editingProductId = productId;
  document.getElementById('adminProductName').value = product.name || '';
  document.getElementById('adminProductBrand').value = product.brand || '';
  if (document.getElementById('adminProductCategory')) document.getElementById('adminProductCategory').value = product.category || '';
  document.getElementById('adminProductRating').value = product.rating || '';
  currentAdminImages = product.images && product.images.length ? [...product.images] : (product.image ? [product.image] : []);
  renderImagePreviewGrid();

  const storesContainer = document.getElementById('adminStores');
  storesContainer.innerHTML = '';
  (product.stores || []).forEach(store => {
    addStoreField();
    const rows = storesContainer.querySelectorAll('div[style]');
    const row = rows[rows.length - 1];
    row.querySelector('.store-name').value = store.name || '';
    row.querySelector('.store-price').value = store.price || '';
    row.querySelector('.store-location').value = store.location || '';
    row.querySelector('.store-phone').value = store.phone || '';
  });
  if (!product.stores || !product.stores.length) addStoreField();

  updateProductPreview();
  showToast('info', 'وضع التعديل', 'عدّل البيانات ثم اضغط حفظ');
}

function resetAdminForm() {
  editingProductId = null;
  currentAdminImages = [];
  document.getElementById('adminProductName').value = '';
  document.getElementById('adminProductBrand').value = '';
  document.getElementById('adminProductRating').value = '';
  document.getElementById('adminImageUrl').value = '';
  renderImagePreviewGrid();
  document.getElementById('adminStores').innerHTML = '';
  addStoreField();
  updateProductPreview();
}

/** NEW: live slug + product-card preview, updated as the admin fills the form. */
function updateSlugPreview() {
  const name = document.getElementById('adminProductName')?.value.trim() || '';
  const slugEl = document.getElementById('adminSlugPreview');
  if (slugEl) slugEl.textContent = name ? '/product/' + generateSlug(name) : '';
  updateProductPreview();
}

function updateProductPreview() {
  const container = document.getElementById('adminProductPreview');
  if (!container) return;
  const name = document.getElementById('adminProductName')?.value.trim();
  const brand = document.getElementById('adminProductBrand')?.value.trim();
  const rating = parseFloat(document.getElementById('adminProductRating')?.value) || 4.5;
  const storeRows = document.getElementById('adminStores')?.querySelectorAll('div[style]') || [];
  const prices = Array.from(storeRows).map(row => parseInt(row.querySelector('.store-price')?.value)).filter(p => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;

  if (!name && !brand) {
    container.innerHTML = '<p style="color:var(--text-tertiary);font-size:12px">هتظهر معاينة المنتج هنا وانت بتكتب البيانات</p>';
    return;
  }

  container.innerHTML = `
    <div class="product-card" style="max-width:180px;pointer-events:none">
      <div class="product-image" style="height:120px">
        ${currentAdminImages[0] ? `<img src="${currentAdminImages[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius)">` : `<span style="font-size:32px">📦</span>`}
      </div>
      <div class="product-info" style="padding:10px">
        <div class="product-brand" style="font-size:11px">${sanitizeHTML(brand || '...')}</div>
        <div class="product-name" style="font-size:13px">${sanitizeHTML(name || 'اسم المنتج')}</div>
        <div style="color:#ffc107;font-size:11px">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</div>
        <div class="product-price" style="font-size:14px">${minPrice !== null ? 'من ' + minPrice.toLocaleString() + ' ج.م' : 'مفيش سعر لسه'}</div>
      </div>
    </div>`;
}

async function saveNewProduct() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }

  const name = document.getElementById('adminProductName').value.trim();
  const brand = document.getElementById('adminProductBrand').value.trim();
  const category = document.getElementById('adminProductCategory').value;
  const rating = parseFloat(document.getElementById('adminProductRating').value) || 4.5;

  if (!name || !brand) { showToast('error', 'خطأ', 'اسم المنتج والماركة مطلوبين'); return; }
  if (!db) { showToast('error', 'خطأ', 'انتظر تحميل Firebase أو أعد تحميل الصفحة'); return; }

  // BUGFIX: prevent duplicate products (same name + brand) - was not checked before.
  if (isDuplicateProduct(name, brand, editingProductId)) {
    showToast('error', 'خطأ', 'يوجد منتج بنفس الاسم والماركة بالفعل');
    return;
  }

  const storeRows = document.getElementById('adminStores').querySelectorAll('div[style]');
  const stores = [];
  storeRows.forEach(row => {
    const storeName = row.querySelector('.store-name')?.value.trim();
    const price = parseInt(row.querySelector('.store-price')?.value);
    const location = row.querySelector('.store-location')?.value.trim();
    const phone = row.querySelector('.store-phone')?.value.trim();
    if (storeName && price) stores.push({ name: storeName, price, location: location || 'غير محدد', phone: phone || '', whatsapp: '' });
  });

  if (stores.length === 0) { showToast('error', 'خطأ', 'أضف محل واحد على الأقل بسعر'); return; }

  const product = { name, brand, category, rating, reviews: 0, stores, image: currentAdminImages[0] || '', images: currentAdminImages.slice(), slug: generateSlug(name) };
  const isEditing = !!editingProductId;

  showLoading(isEditing ? 'جاري حفظ التعديلات...' : 'جاري إضافة المنتج...');
  try {
    if (isEditing) {
      await Promise.race([
        updateProductInFirestore(editingProductId, product),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      const idx = productsData.findIndex(p => normalizeId(p.id) === normalizeId(editingProductId));
      if (idx !== -1) productsData[idx] = { ...productsData[idx], ...product };
      showToast('success', 'تم!', 'تم حفظ التعديلات بنجاح 🎉');
    } else {
      const id = await Promise.race([
        addProductToFirestore(product),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      product.id = id;
      productsData.unshift(product);
      showToast('success', 'تم!', 'تم إضافة المنتج بنجاح 🎉');
    }
    renderProducts();
    renderAdminProducts();
    hideLoading();
    resetAdminForm();
  } catch(e) {
    hideLoading();
    if (e.message === 'timeout') {
      showToast('error', 'خطأ', 'انتهى الوقت - تحقق من الإنترنت وحاول تاني');
    } else {
      showToast('error', 'خطأ', 'فشل حفظ المنتج: ' + e.message);
    }
    console.error('saveNewProduct error:', e);
  }
}


// ==================== STORES MANAGEMENT (NEW) ====================
// A dedicated `stores` collection so store info (name/logo/contact/color) is
// entered once and reused across every product, instead of being retyped
// by hand each time a product is added.
let storesData = [];
let editingStoreId = null;
let currentStoreLogo = '';
let storesCurrentPage = 1;
const STORES_PER_PAGE = 8;
let storesLoadedOnce = false;

async function loadStoresFromFirestore() {
  if (!db) return;
  try {
    const snapshot = await db.collection('stores').orderBy('name').get();
    storesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    storesLoadedOnce = true;
  } catch (e) {
    console.error('Error loading stores:', e);
  }
}

function openStoresManagement() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه الصفحة مخصصة للإدارة فقط'); return; }
  openModal('storesModal');
  resetStoreForm();
  // Load once, then just re-render from the in-memory copy - avoids
  // re-querying Firestore every time the admin opens this modal.
  (storesLoadedOnce ? Promise.resolve() : loadStoresFromFirestore()).then(renderStoresList);
}

async function handleStoreLogoUpload(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('error', 'خطأ', 'الشعار أكبر من 5MB'); return; }
  const placeholder = document.getElementById('storeLogoPlaceholder');
  placeholder.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:24px;color:#0f9d58"></i>';
  try {
    const compressed = await compressImage(file, { maxDimension: 400, quality: 0.85 });
    const data = await uploadToCloudinary(compressed);
    currentStoreLogo = data.secure_url;
    document.getElementById('storeLogoPreview').src = currentStoreLogo;
    document.getElementById('storeLogoPreviewContainer').style.display = 'block';
    placeholder.style.display = 'none';
  } catch (e) {
    showToast('error', 'خطأ', 'فشل رفع الشعار');
    placeholder.innerHTML = '<i class="fas fa-cloud-upload-alt" style="font-size:28px;color:#0f9d58"></i><p style="color:var(--text-secondary);font-size:12px;margin:4px 0 0">ارفع شعار المتجر</p>';
  }
}

function resetStoreForm() {
  editingStoreId = null;
  currentStoreLogo = '';
  document.getElementById('storeFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة متجر جديد';
  document.getElementById('storeName').value = '';
  document.getElementById('storeWebsite').value = '';
  document.getElementById('storePhone').value = '';
  document.getElementById('storeEmail').value = '';
  document.getElementById('storeAddress').value = '';
  document.getElementById('storeColor').value = '#1a73e8';
  document.getElementById('storeActive').checked = true;
  document.getElementById('storeLogoPreviewContainer').style.display = 'none';
  document.getElementById('storeLogoPlaceholder').style.display = 'block';
  document.getElementById('storeLogoPlaceholder').innerHTML = '<i class="fas fa-cloud-upload-alt" style="font-size:28px;color:#0f9d58"></i><p style="color:var(--text-secondary);font-size:12px;margin:4px 0 0">ارفع شعار المتجر</p>';
  document.getElementById('cancelStoreEditBtn').style.display = 'none';
}

function editStore(storeId) {
  const store = storesData.find(s => s.id === storeId);
  if (!store) return;
  editingStoreId = storeId;
  currentStoreLogo = store.logo || '';
  document.getElementById('storeFormTitle').innerHTML = '<i class="fas fa-pen"></i> تعديل المتجر';
  document.getElementById('storeName').value = store.name || '';
  document.getElementById('storeWebsite').value = store.website || '';
  document.getElementById('storePhone').value = store.phone || '';
  document.getElementById('storeEmail').value = store.email || '';
  document.getElementById('storeAddress').value = store.address || '';
  document.getElementById('storeColor').value = store.color || '#1a73e8';
  document.getElementById('storeActive').checked = store.active !== false;
  if (store.logo) {
    document.getElementById('storeLogoPreview').src = store.logo;
    document.getElementById('storeLogoPreviewContainer').style.display = 'block';
    document.getElementById('storeLogoPlaceholder').style.display = 'none';
  }
  document.getElementById('cancelStoreEditBtn').style.display = 'block';
  document.getElementById('storeFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveStore() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  const name = document.getElementById('storeName').value.trim();
  if (!name) { showToast('error', 'خطأ', 'اسم المتجر مطلوب'); return; }

  // Prevent two stores with the exact same name (case-insensitive).
  const dup = storesData.find(s => s.name.trim().toLowerCase() === name.toLowerCase() && s.id !== editingStoreId);
  if (dup) { showToast('error', 'خطأ', 'يوجد متجر بنفس الاسم بالفعل'); return; }

  const store = {
    name,
    logo: currentStoreLogo,
    website: document.getElementById('storeWebsite').value.trim(),
    phone: document.getElementById('storePhone').value.trim(),
    email: document.getElementById('storeEmail').value.trim(),
    address: document.getElementById('storeAddress').value.trim(),
    color: document.getElementById('storeColor').value,
    active: document.getElementById('storeActive').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  showLoading(editingStoreId ? 'جاري حفظ التعديلات...' : 'جاري إضافة المتجر...');
  try {
    if (editingStoreId) {
      await db.collection('stores').doc(editingStoreId).update(store);
      const idx = storesData.findIndex(s => s.id === editingStoreId);
      if (idx !== -1) storesData[idx] = { ...storesData[idx], ...store };
      showToast('success', 'تم!', 'اتحفظت تعديلات المتجر');
    } else {
      store.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('stores').add(store);
      storesData.push({ id: docRef.id, ...store });
      showToast('success', 'تم!', 'اتضاف المتجر بنجاح 🎉');
    }
    resetStoreForm();
    renderStoresList();
  } catch (e) {
    showToast('error', 'خطأ', 'فشل حفظ المتجر: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

async function deleteStore(storeId) {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }
  if (!confirm('هتحذف المتجر ده؟ (مش هيتحذف من المنتجات اللي مضاف ليها بالفعل)')) return;
  try {
    await db.collection('stores').doc(storeId).delete();
    storesData = storesData.filter(s => s.id !== storeId);
    renderStoresList();
    showToast('success', 'تم!', 'اتحذف المتجر');
  } catch (e) {
    showToast('error', 'خطأ', 'فشل حذف المتجر: ' + (e.message || ''));
  }
}

async function toggleStoreActive(storeId, active) {
  if (!isAdminUser) return;
  try {
    await db.collection('stores').doc(storeId).update({ active });
    const store = storesData.find(s => s.id === storeId);
    if (store) store.active = active;
    renderStoresList();
  } catch (e) {
    showToast('error', 'خطأ', 'فشل تحديث حالة المتجر');
  }
}

function renderStoresList() {
  const container = document.getElementById('storesListContainer');
  if (!container) return;

  const searchTerm = (document.getElementById('storeSearchInput')?.value || '').trim().toLowerCase();
  const filterActive = document.getElementById('storeFilterActive')?.value || 'all';
  const sortBy = document.getElementById('storeSortBy')?.value || 'name';

  let filtered = storesData.filter(s => {
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm)) return false;
    if (filterActive === 'active' && s.active === false) return false;
    if (filterActive === 'inactive' && s.active !== false) return false;
    return true;
  });

  if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  else if (sortBy === 'newest') filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  else if (sortBy === 'oldest') filtered.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  const totalPages = Math.max(1, Math.ceil(filtered.length / STORES_PER_PAGE));
  storesCurrentPage = Math.min(storesCurrentPage, totalPages);
  const pageItems = filtered.slice((storesCurrentPage - 1) * STORES_PER_PAGE, storesCurrentPage * STORES_PER_PAGE);

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary)"><i class="fas fa-store-slash" style="font-size:36px;margin-bottom:10px;display:block;opacity:0.4"></i><p>مفيش متاجر مطابقة</p></div>`;
    document.getElementById('storesPagination').innerHTML = '';
    return;
  }

  container.innerHTML = pageItems.map(s => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--bg-secondary);opacity:${s.active === false ? '0.55' : '1'}">
      ${s.logo ? `<img src="${s.logo}" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:10px;flex-shrink:0">` : `<div style="width:48px;height:48px;border-radius:10px;background:${s.color || 'var(--primary)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${sanitizeHTML((s.name || '?')[0])}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitizeHTML(s.name)}</div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${sanitizeHTML(s.phone || s.address || '')}</div>
      </div>
      <label style="display:flex;align-items:center;cursor:pointer" title="${s.active === false ? 'موقوف' : 'مفعّل'}">
        <input type="checkbox" ${s.active === false ? '' : 'checked'} onchange="toggleStoreActive('${s.id}', this.checked)">
      </label>
      <button onclick="editStore('${s.id}')" style="background:rgba(15,157,88,0.1);color:#0f9d58;border:1px solid rgba(15,157,88,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-pen"></i></button>
      <button onclick="deleteStore('${s.id}')" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');

  const pagination = document.getElementById('storesPagination');
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  let pageBtns = '';
  for (let i = 1; i <= totalPages; i++) {
    pageBtns += `<button onclick="storesCurrentPage=${i};renderStoresList()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:${i === storesCurrentPage ? '#0f9d58' : 'var(--bg-card)'};color:${i === storesCurrentPage ? '#fff' : 'var(--text)'};cursor:pointer;font-size:12px;font-weight:700">${i}</button>`;
  }
  pagination.innerHTML = pageBtns;
}
