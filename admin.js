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
  renderAdminProducts();
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

async function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('error', 'خطأ', 'الصورة أكبر من 5MB'); return; }

  document.getElementById('imageUploadPlaceholder').style.display = 'none';
  document.getElementById('imageUploadProgress').style.display = 'block';
  document.getElementById('progressBar').style.width = '15%';

  // NEW: show an instant local preview while the upload is in flight, so the
  // admin gets feedback immediately instead of staring at a blank progress bar.
  const localUrl = URL.createObjectURL(file);
  const previewImg = document.getElementById('imagePreview');
  if (previewImg) previewImg.src = localUrl;

  try {
    // NEW: compress/resize client-side before upload - smaller payload,
    // faster upload, less Cloudinary bandwidth, same visible quality.
    document.getElementById('progressBar').style.width = '35%';
    const compressed = await compressImage(file);

    document.getElementById('progressBar').style.width = '60%';
    const data = await uploadToCloudinary(compressed);
    document.getElementById('progressBar').style.width = '100%';

    document.getElementById('adminImageUrl').value = data.secure_url;
    if (previewImg) previewImg.src = data.secure_url;
    document.getElementById('imageUploadProgress').style.display = 'none';
    document.getElementById('imagePreviewContainer').style.display = 'block';
    showToast('success', 'تم!', 'تم رفع الصورة بنجاح');
  } catch (e) {
    document.getElementById('imageUploadProgress').style.display = 'none';
    document.getElementById('imageUploadPlaceholder').style.display = 'block';
    showToast('error', 'خطأ', 'فشل رفع الصورة، حاول مرة أخرى');
  } finally {
    URL.revokeObjectURL(localUrl);
  }
}

function addStoreField() {
  const container = document.getElementById('adminStores');
  const idx = container.children.length + 1;
  const storeDiv = document.createElement('div');
  storeDiv.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px';
  storeDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-weight:700;font-size:13px;color:var(--primary)"><i class="fas fa-store"></i> محل #${idx}</span>
      <button data-onclick="this.closest('div[style]').remove()" style="background:var(--danger);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px"><i class="fas fa-trash"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <input type="text" class="form-input store-name" placeholder="اسم المحل (بي تك، نون...)" style="font-size:13px">
      <input type="number" class="form-input store-price" placeholder="السعر بالجنيه" style="font-size:13px">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <input type="text" class="form-input store-location" placeholder="الموقع (القاهرة...)" style="font-size:13px">
      <input type="text" class="form-input store-phone" placeholder="رقم التليفون" style="font-size:13px">
    </div>`;
  container.appendChild(storeDiv);
}

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

  if (firestoreProducts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary)"><i class="fas fa-box-open" style="font-size:40px;margin-bottom:10px;display:block;opacity:0.4"></i><p>لا توجد منتجات مضافة بعد</p></div>`;
    return;
  }
  list.innerHTML = firestoreProducts.map(p => {
    const minPrice = getMinPrice(p) ?? 0;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--bg-secondary)">
      ${p.image ? `<img src="${p.image}" loading="lazy" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0">` : `<div style="width:56px;height:56px;background:var(--bg-tertiary);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📦</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">${p.brand} • ${p.stores ? p.stores.length : 0} محلات</div>
        <div style="font-size:13px;color:var(--primary);font-weight:700;margin-top:4px">من ${minPrice.toLocaleString()} ج.م</div>
      </div>
      <button data-onclick="editProduct('${p.id}')" style="background:rgba(26,115,232,0.1);color:var(--primary);border:1px solid rgba(26,115,232,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-pen"></i></button>
      <button data-onclick="deleteProduct('${p.id}')" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');
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
  document.getElementById('adminImageUrl').value = product.image || '';
  if (product.image) {
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const placeholder = document.getElementById('imageUploadPlaceholder');
    if (preview) preview.src = product.image;
    if (previewContainer) previewContainer.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }

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

  showToast('info', 'وضع التعديل', 'عدّل البيانات ثم اضغط حفظ');
}

function resetAdminForm() {
  editingProductId = null;
  document.getElementById('adminProductName').value = '';
  document.getElementById('adminProductBrand').value = '';
  document.getElementById('adminProductRating').value = '';
  document.getElementById('adminImageUrl').value = '';
  const previewContainer = document.getElementById('imagePreviewContainer');
  const placeholder = document.getElementById('imageUploadPlaceholder');
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
  document.getElementById('adminStores').innerHTML = '';
  addStoreField();
}

async function saveNewProduct() {
  if (!isAdminUser) { showToast('error', 'غير مصرح', 'هذه العملية تتطلب صلاحية إدارة'); return; }

  const name = document.getElementById('adminProductName').value.trim();
  const brand = document.getElementById('adminProductBrand').value.trim();
  const category = document.getElementById('adminProductCategory').value;
  const rating = parseFloat(document.getElementById('adminProductRating').value) || 4.5;
  const image = document.getElementById('adminImageUrl').value;

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

  const product = { name, brand, category, rating, reviews: 0, stores, image: image || '' };
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

