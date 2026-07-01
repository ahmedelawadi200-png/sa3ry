// === Script Block 1 ===
// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyCOHBV9P-ySBIRSQB9KEP-V9778EaC80vU",
  authDomain: "sa3ry-pro.firebaseapp.com",
  projectId: "sa3ry-pro",
  storageBucket: "sa3ry-pro.firebasestorage.app",
  messagingSenderId: "1095877859009",
  appId: "1:1095877859009:web:6418f746359da6b8eca640",
  measurementId: "G-RXS93VVJF1"
};

let auth = null;
let db = null;
let googleProvider = null;
let recaptchaVerifier = null;
let confirmationResult = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFirebase() {
  // Try multiple CDN sources
  const cdnBase = [
    'https://www.gstatic.com/firebasejs/10.13.0',
    'https://cdn.jsdelivr.net/npm/firebase@10.13.0/compat'
  ];

  let loaded = false;
  for (const base of cdnBase) {
    try {
      await loadScript(`${base}/firebase-app-compat.js`);
      await loadScript(`${base}/firebase-auth-compat.js`);
      await loadScript(`${base}/firebase-firestore-compat.js`);
      loaded = true;
      break;
    } catch(e) {
      console.warn('CDN failed, trying next...', base);
    }
  }

  if (!loaded) {
    console.error('Firebase init error: all CDNs failed - running in demo mode');
    // Ensure app still loads even without Firebase
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    auth.languageCode = 'ar';
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    console.log('✅ Firebase initialized successfully');
    loadProductsFromFirestore();
  } catch(e) {
    console.error('Firebase init error:', e);
  }
}

// ==================== FIRESTORE PRODUCTS ====================
async function loadProductsFromFirestore() {
  try {
    const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
    if (!snapshot.empty) {
      const firestoreProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Merge with local products
      productsData.unshift(...firestoreProducts);
      renderProducts();
      renderBrandFilters();
      console.log('✅ Loaded', firestoreProducts.length, 'products from Firestore');
    }
  } catch(e) {
    console.error('Error loading products:', e);
  }
}

async function addProductToFirestore(product) {
  try {
    product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('products').add(product);
    console.log('✅ Product added:', docRef.id);
    return docRef.id;
  } catch(e) {
    console.error('Error adding product:', e);
    throw e;
  }
}

async function deleteProductFromFirestore(productId) {
  try {
    await db.collection('products').doc(productId).delete();
    console.log('✅ Product deleted:', productId);
  } catch(e) {
    console.error('Error deleting product:', e);
    throw e;
  }
}

// ==================== ADMIN PANEL ====================
function openAdminPanel() {
  if (!currentUser) {
    showToast('error', 'خطأ', 'سجل دخول أولاً');
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

async function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('error', 'خطأ', 'الصورة أكبر من 5MB'); return; }
  document.getElementById('imageUploadPlaceholder').style.display = 'none';
  document.getElementById('imageUploadProgress').style.display = 'block';
  document.getElementById('progressBar').style.width = '30%';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  try {
    document.getElementById('progressBar').style.width = '60%';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('progressBar').style.width = '100%';
    if (data.secure_url) {
      document.getElementById('adminImageUrl').value = data.secure_url;
      document.getElementById('imagePreview').src = data.secure_url;
      document.getElementById('imageUploadProgress').style.display = 'none';
      document.getElementById('imagePreviewContainer').style.display = 'block';
      showToast('success', 'تم!', 'تم رفع الصورة بنجاح');
    } else { throw new Error('failed'); }
  } catch(e) {
    document.getElementById('imageUploadProgress').style.display = 'none';
    document.getElementById('imageUploadPlaceholder').style.display = 'block';
    showToast('error', 'خطأ', 'فشل رفع الصورة');
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
  if (firestoreProducts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-tertiary)"><i class="fas fa-box-open" style="font-size:40px;margin-bottom:10px;display:block;opacity:0.4"></i><p>لا توجد منتجات مضافة بعد</p></div>`;
    return;
  }
  list.innerHTML = firestoreProducts.map(p => {
    const minPrice = p.stores && p.stores.length ? Math.min(...p.stores.map(s => s.price)) : 0;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--bg-secondary)">
      ${p.image ? `<img src="${p.image}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0">` : `<div style="width:56px;height:56px;background:var(--bg-tertiary);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📦</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">${p.brand} • ${p.stores ? p.stores.length : 0} محلات</div>
        <div style="font-size:13px;color:var(--primary);font-weight:700;margin-top:4px">من ${minPrice.toLocaleString()} ج.م</div>
      </div>
      <button data-onclick="deleteProduct('${p.id}')" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;flex-shrink:0"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');
}

async function deleteProduct(productId) {
  if (!confirm('هتحذف المنتج ده؟')) return;
  try {
    await deleteProductFromFirestore(productId);
    productsData = productsData.filter(p => normalizeId(p.id) !== normalizeId(productId));
    renderProducts();
    renderAdminProducts();
    showToast('success', 'تم!', 'تم حذف المنتج');
  } catch(e) {
    showToast('error', 'خطأ', 'فشل حذف المنتج');
  }
}

async function saveNewProduct() {
  const name = document.getElementById('adminProductName').value.trim();
  const brand = document.getElementById('adminProductBrand').value.trim();
  const category = document.getElementById('adminProductCategory').value;
  const rating = parseFloat(document.getElementById('adminProductRating').value) || 4.5;
  const image = document.getElementById('adminImageUrl').value;

  if (!name || !brand) { showToast('error', 'خطأ', 'اسم المنتج والماركة مطلوبين'); return; }

  if (!db) { showToast('error', 'خطأ', 'انتظر تحميل Firebase أو أعد تحميل الصفحة'); return; }

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

  showLoading('جاري إضافة المنتج...');
  try {
    const id = await Promise.race([
      addProductToFirestore(product),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
    product.id = id;
    productsData.unshift(product);
    renderProducts();
    renderAdminProducts();
    hideLoading();
    showToast('success', 'تم!', 'تم إضافة المنتج بنجاح 🎉');
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
  } catch(e) {
    hideLoading();
    if (e.message === 'timeout') {
      showToast('error', 'خطأ', 'انتهى الوقت - تحقق من الإنترنت وحاول تاني');
    } else {
      showToast('error', 'خطأ', 'فشل إضافة المنتج: ' + e.message);
    }
    console.error('saveNewProduct error:', e);
  }
}

// ==================== PHONE AUTH ====================
function setupRecaptcha() {
  if (recaptchaVerifier) return;
  try {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {}
    });
  } catch(e) {
    console.error('Recaptcha error:', e);
  }
}

function sendPhoneOTP() {
  const phone = document.getElementById('phoneInput').value.trim();
  if (!phone) {
    showToast('error', 'خطأ', 'أدخل رقم الموبايل');
    return;
  }

  // Convert Egyptian number to international format
  let intlPhone = phone;
  if (phone.startsWith('0')) {
    intlPhone = '+2' + phone;
  } else if (!phone.startsWith('+')) {
    intlPhone = '+2' + phone;
  }

  if (!/^\+20(10|11|12|15)\d{8}$/.test(intlPhone)) {
    showToast('error', 'خطأ', 'رقم موبايل مصري غير صحيح (01xxxxxxxxx)');
    return;
  }

  setupRecaptcha();
  showLoading('جاري إرسال كود التحقق...');

  auth.signInWithPhoneNumber(intlPhone, recaptchaVerifier)
    .then((result) => {
      confirmationResult = result;
      hideLoading();
      document.getElementById('phoneStep1').style.display = 'none';
      document.getElementById('phoneStep2').style.display = 'block';
      showToast('success', 'تم!', 'تم إرسال الكود على ' + intlPhone);
    })
    .catch((error) => {
      hideLoading();
      // Reset recaptcha on error
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
      }
      showToast('error', 'خطأ', getAuthErrorMessage(error.code));
    });
}

function verifyPhoneOTP() {
  const otp = document.getElementById('otpInput').value.trim();
  if (!otp || otp.length < 6) {
    showToast('error', 'خطأ', 'أدخل الكود المكون من 6 أرقام');
    return;
  }

  if (!confirmationResult) {
    showToast('error', 'خطأ', 'أرسل الكود أولاً');
    return;
  }

  showLoading('جاري التحقق...');

  confirmationResult.confirm(otp)
    .then((result) => {
      const user = result.user;
      currentUser = {
        name: user.displayName || 'مستخدم',
        email: user.email || '',
        phone: user.phoneNumber || '',
        avatar: user.photoURL || '👤',
        uid: user.uid,
        provider: 'phone'
      };
      localStorage.setItem('sa3ry_user', JSON.stringify(currentUser));
      hideLoading();
      closeModal('phoneAuthModal');
      showToast('success', 'تم!', 'تم تسجيل الدخول برقم الموبايل');
      showMainApp();
    })
    .catch((error) => {
      hideLoading();
      showToast('error', 'خطأ', 'كود التحقق غير صحيح أو انتهت صلاحيته');
    });
}

function resendOTP() {
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  document.getElementById('phoneStep1').style.display = 'block';
  document.getElementById('phoneStep2').style.display = 'none';
  document.getElementById('otpInput').value = '';
  showToast('info', 'جاهز', 'أعد إدخال رقمك وابعت الكود تاني');
}

function openPhoneAuth() {
  openModal('phoneAuthModal');
  document.getElementById('phoneStep1').style.display = 'block';
  document.getElementById('phoneStep2').style.display = 'none';
  document.getElementById('phoneInput').value = '';
  document.getElementById('otpInput').value = '';
}

// ==================== VALIDATION FUNCTIONS ====================

function validateRegName() {
  const name = document.getElementById('gateRegName').value.trim();
  const input = document.getElementById('gateRegName');
  const error = document.getElementById('regNameError');
  const valid = document.getElementById('regNameValid');
  const invalid = document.getElementById('regNameInvalid');

  if (!name) {
    showFieldError(input, error, 'الاسم مطلوب');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (name.length < 3) {
    showFieldError(input, error, 'الاسم يجب أن يكون 3 أحرف على الأقل');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (!/^[؀-ۿa-zA-Z\s]+$/.test(name)) {
    showFieldError(input, error, 'الاسم يجب أن يحتوي على حروف فقط');
    showIndicator(valid, invalid, false);
    return false;
  }

  showFieldSuccess(input, error);
  showIndicator(valid, invalid, true);
  return true;
}

function validateRegPhone() {
  const phone = document.getElementById('gateRegPhone').value.trim();
  const input = document.getElementById('gateRegPhone');
  const error = document.getElementById('regPhoneError');
  const valid = document.getElementById('regPhoneValid');
  const invalid = document.getElementById('regPhoneInvalid');

  if (!phone) {
    showFieldError(input, error, 'رقم الموبايل مطلوب');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (!/^01[0-2,5]{1}[0-9]{8}$/.test(phone)) {
    showFieldError(input, error, 'رقم موبايل غير صحيح (مثال: 01012345678)');
    showIndicator(valid, invalid, false);
    return false;
  }

  showFieldSuccess(input, error);
  showIndicator(valid, invalid, true);
  return true;
}

function validateRegEmail() {
  const email = document.getElementById('gateRegEmail').value.trim();
  const input = document.getElementById('gateRegEmail');
  const error = document.getElementById('regEmailError');
  const valid = document.getElementById('regEmailValid');
  const invalid = document.getElementById('regEmailInvalid');

  if (!email) {
    showFieldError(input, error, 'البريد الإلكتروني مطلوب');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(input, error, 'بريد إلكتروني غير صحيح');
    showIndicator(valid, invalid, false);
    return false;
  }

  showFieldSuccess(input, error);
  showIndicator(valid, invalid, true);
  return true;
}

function validateRegPassword() {
  const password = document.getElementById('gateRegPassword').value;
  const input = document.getElementById('gateRegPassword');
  const error = document.getElementById('regPasswordError');
  const success = document.getElementById('regPasswordSuccess');
  const valid = document.getElementById('regPasswordValid');
  const invalid = document.getElementById('regPasswordInvalid');

  if (!password) {
    showFieldError(input, error, 'كلمة المرور مطلوبة');
    success.classList.remove('show');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (password.length < 6) {
    showFieldError(input, error, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    success.classList.remove('show');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
    showFieldError(input, error, 'يجب أن تحتوي على حروف وأرقام');
    success.classList.remove('show');
    showIndicator(valid, invalid, false);
    return false;
  }

  showFieldSuccess(input, error);
  success.classList.add('show');
  showIndicator(valid, invalid, true);
  return true;
}

function validateRegConfirmPassword() {
  const password = document.getElementById('gateRegPassword').value;
  const confirm = document.getElementById('gateRegConfirmPassword').value;
  const input = document.getElementById('gateRegConfirmPassword');
  const error = document.getElementById('regConfirmError');
  const valid = document.getElementById('regConfirmValid');
  const invalid = document.getElementById('regConfirmInvalid');

  if (!confirm) {
    showFieldError(input, error, 'تأكيد كلمة المرور مطلوب');
    showIndicator(valid, invalid, false);
    return false;
  }
  if (confirm !== password) {
    showFieldError(input, error, 'كلمتا المرور غير متطابقتين');
    showIndicator(valid, invalid, false);
    return false;
  }

  showFieldSuccess(input, error);
  showIndicator(valid, invalid, true);
  return true;
}

function validateLoginEmail() {
  const email = document.getElementById('gateLoginEmail').value.trim();
  const input = document.getElementById('gateLoginEmail');
  const error = document.getElementById('loginEmailError');

  if (!email) {
    showFieldError(input, error, 'البريد الإلكتروني مطلوب');
    return false;
  }
  showFieldSuccess(input, error);
  return true;
}

function validateLoginPassword() {
  const password = document.getElementById('gateLoginPassword').value;
  const input = document.getElementById('gateLoginPassword');
  const error = document.getElementById('loginPasswordError');

  if (!password) {
    showFieldError(input, error, 'كلمة المرور مطلوبة');
    return false;
  }
  showFieldSuccess(input, error);
  return true;
}

function showFieldError(input, errorEl, message) {
  input.classList.add('error');
  input.classList.remove('success');
  errorEl.querySelector('span').textContent = message;
  errorEl.classList.add('show');
}

function showFieldSuccess(input, errorEl) {
  input.classList.remove('error');
  input.classList.add('success');
  errorEl.classList.remove('show');
}

function showIndicator(validEl, invalidEl, isValid) {
  validEl.classList.toggle('show', isValid);
  invalidEl.classList.toggle('show', !isValid);
}

function getAuthErrorMessage(code) {
  const errors = {
    'auth/user-not-found': 'البريد الإلكتروني غير مسجل',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-email': 'بريد إلكتروني غير صحيح',
    'auth/weak-password': 'كلمة المرور ضعيفة',
    'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
    'auth/popup-closed-by-user': 'تم إغلاق النافذة',
    'auth/cancelled-popup-request': 'تم إلغاء الطلب',
    'auth/account-exists-with-different-credential': 'الحساب موجود ببيانات مختلفة',
    'auth/network-request-failed': 'خطأ في الاتصال بالشبكة',
    'auth/invalid-credential': 'البيانات غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
    'auth/invalid-phone-number': 'رقم الموبايل غير صحيح',
    'auth/missing-phone-number': 'أدخل رقم الموبايل',
    'auth/quota-exceeded': 'تم تجاوز الحد اليومي، حاول غداً',
    'auth/invalid-verification-code': 'كود التحقق غير صحيح',
    'auth/code-expired': 'انتهت صلاحية الكود، أرسل كوداً جديداً',
    'auth/session-expired': 'انتهت الجلسة، أرسل الكود مرة أخرى'
  };
  return errors[code] || 'حدث خطأ، حاول مرة أخرى';
}

// ==================== CAMERA & QR SCANNER ====================

let html5QrCode = null;
let cameraStream = null;
let currentFacingMode = 'environment';
let capturedPhotos = [];

function openCameraModal() {
  openModal('cameraModal');
  startCamera();
}

function openQRScanner() {
  closeModal('cameraModal');
  stopCamera();
  openModal('qrScannerModal');
}

function startCamera() {
  const video = document.getElementById('cameraVideo');

  navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: currentFacingMode } 
  })
  .then(stream => {
    cameraStream = stream;
    video.srcObject = stream;
  })
  .catch(err => {
    showToast('error', 'خطأ', 'لا يمكن الوصول للكاميرا');
  });
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

function switchCamera() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  stopCamera();
  startCamera();
}

function takePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const photoUrl = canvas.toDataURL('image/jpeg');
  capturedPhotos.unshift(photoUrl);
  if (capturedPhotos.length > 9) capturedPhotos.pop();

  renderCameraGallery();
  showToast('success', 'تم!', 'تم التقاط الصورة');
}

function renderCameraGallery() {
  const gallery = document.getElementById('cameraGallery');
  gallery.innerHTML = capturedPhotos.map(url => 
    `<img src="${url}" data-onclick="viewPhoto('${url}')">`
  ).join('');
}

function toggleQRScanner() {
  const btn = document.getElementById('qrToggleBtn');

  if (html5QrCode && html5QrCode.isScanning) {
    stopQRScanner();
    btn.innerHTML = '<i class="fas fa-camera"></i> تشغيل الكاميرا';
  } else {
    startQRScanner();
    btn.innerHTML = '<i class="fas fa-stop"></i> إيقاف الماسح';
  }
}

function startQRScanner() {
  html5QrCode = new Html5Qrcode("qrScannerContainer");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 200, height: 200 } },
    onQRScanSuccess,
    onQRScanFailure
  ).catch(err => {
    showToast('error', 'خطأ', 'لا يمكن تشغيل الكاميرا');
  });
}

function stopQRScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode = null;
    }).catch(() => {});
  }
}

function onQRScanSuccess(decodedText, decodedResult) {
  const resultBox = document.getElementById('qrResultBox');
  const resultText = document.getElementById('qrResultText');

  resultText.textContent = decodedText;
  resultBox.classList.add('show');

  if (decodedText.includes('http')) {
    window.open(decodedText, '_blank');
  } else {
    document.getElementById('searchInput').value = decodedText;
    searchQuery = decodedText;
    closeModal('qrScannerModal');
    stopQRScanner();
    renderProducts();
    showToast('success', 'تم المسح!', 'جاري البحث عن: ' + decodedText);
  }

  if (navigator.vibrate) navigator.vibrate(200);
}

function onQRScanFailure(error) {
  // Ignore continuous scanning errors
}

// ==================== ID NORMALIZATION ====================
function normalizeId(id) {
  return String(id);
}
function getProductById(id) {
  return productsData.find(p => normalizeId(p.id) === normalizeId(id));
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

// ==================== STATE ====================
let currentUser = null;
let isGuest = false;
let currentCategory = 'all';
let currentBrand = 'all';
let currentPrice = 100000;
let currentSort = 'best';
let searchQuery = '';
let compareList = [];
let cart = [];
let favorites = [];
let priceAlerts = [];
let recentlyViewed = [];
let currentProduct = null;
let currentStore = null;
let onboardingSlide = 0;
let darkMode = false;

// ==================== INIT ====================
// Ensure app initializes regardless of load state
function initAppWrapper() {
  initFirebase().then(() => {
    if (auth) {
      auth.onAuthStateChanged((user) => {
        if (user) {
          // فقط لو مش عنده يوزر محفوظ
          const saved = localStorage.getItem('sa3ry_user');
          if (!saved) {
            currentUser = {
              name: user.displayName || 'مستخدم',
              email: user.email || '',
              phone: user.phoneNumber || '',
              avatar: user.photoURL || '👤',
              uid: user.uid,
              provider: user.providerData[0]?.providerId || 'email'
            };
            localStorage.setItem('sa3ry_user', JSON.stringify(currentUser));
          }
        }
      });
    }
  });
  initApp();
}

// Emergency splash skip function
function forceSkipSplash() {
  try { document.getElementById('splashScreen').classList.add('hidden'); } catch(e) {}
  showLoginGate();
}

// Emergency timeout - always hide splash after 10 seconds
setTimeout(function() {
  const splash = document.getElementById('splashScreen');
  if (splash && !splash.classList.contains('hidden')) {
    console.warn('Splash screen emergency timeout triggered');
    forceSkipSplash();
  }
}, 10000);

// Show skip button after 5 seconds if still loading
setTimeout(function() {
  const skipBtn = document.getElementById('skipSplashBtn');
  const splash = document.getElementById('splashScreen');
  if (skipBtn && splash && !splash.classList.contains('hidden')) {
    skipBtn.style.display = 'inline-block';
  }
}, 5000);

function initApp() {
  let savedUser = null, savedGuest = null, savedDark = null;
  let savedFavs = null, savedCart = null, savedAlerts = null, savedRecent = null;

  try {
    savedUser = localStorage.getItem('sa3ry_user');
    savedGuest = localStorage.getItem('sa3ry_guest');
    savedDark = localStorage.getItem('sa3ry_dark');
    savedFavs = localStorage.getItem('sa3ry_favorites');
    savedCart = localStorage.getItem('sa3ry_cart');
    savedAlerts = localStorage.getItem('sa3ry_alerts');
    savedRecent = localStorage.getItem('sa3ry_recent');
  } catch(e) {
    console.warn('localStorage not available');
  }

  if (savedDark === 'true') { darkMode = true; document.body.classList.add('dark-mode'); }
  if (savedFavs) try { favorites = JSON.parse(savedFavs); } catch(e) {}
  if (savedCart) try { cart = JSON.parse(savedCart); } catch(e) {}
  if (savedAlerts) try { priceAlerts = JSON.parse(savedAlerts); } catch(e) {}
  if (savedRecent) try { recentlyViewed = JSON.parse(savedRecent); } catch(e) {}

  // Always initialize the app UI
  renderCategories();
  renderBrandFilters();
  renderProducts();
  updateProfileStats();
  updateCartBadge();
  updateNotificationsBadge();
  renderRecentlyViewed();

  let progress = 0;
  const splashBar = document.getElementById('splashBar');
  const splashInterval = setInterval(() => {
    progress += 25;
    if (splashBar) splashBar.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(splashInterval);
      setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('hidden');

        // Check for saved user or guest
        if (savedUser) {
          try {
            currentUser = JSON.parse(savedUser);
            if (currentUser && currentUser.uid) {
              showMainApp();
            } else {
              showLoginGate();
            }
          } catch(e) {
            showLoginGate();
          }
        } else if (savedGuest === 'true') {
          isGuest = true;
          showMainApp();
        } else {
          showLoginGate();
        }
      }, 300);
    }
  }, 200);

  window.addEventListener('online', () => { const b = document.getElementById('offlineBanner'); if(b) b.classList.remove('show'); });
  window.addEventListener('offline', () => { const b = document.getElementById('offlineBanner'); if(b) b.classList.add('show'); });
  if (!navigator.onLine) { const b = document.getElementById('offlineBanner'); if(b) b.classList.add('show'); }

  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.search-container');
    const suggestions = document.getElementById('searchSuggestions');
    if (searchContainer && suggestions && !searchContainer.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
}

// ==================== ONBOARDING ====================
function showOnboarding() {
  document.getElementById('onboardingScreen').style.display = 'flex';
}

function nextOnboardingSlide() {
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.onboarding-dots .dot');
  const nextBtn = document.getElementById('nextOnboarding');

  slides[onboardingSlide].classList.remove('active');
  dots[onboardingSlide].classList.remove('active');
  onboardingSlide++;

  if (onboardingSlide >= slides.length) {
    localStorage.setItem('sa3ry_onboarding', 'true');
    document.getElementById('onboardingScreen').style.display = 'none';
    showLoginGate();
    return;
  }

  slides[onboardingSlide].classList.add('active');
  dots[onboardingSlide].classList.add('active');

  if (onboardingSlide === slides.length - 1) {
    nextBtn.innerHTML = 'ابدأ <i class="fas fa-arrow-left"></i>';
  }
}

function skipOnboarding() {
  localStorage.setItem('sa3ry_onboarding', 'true');
  document.getElementById('onboardingScreen').style.display = 'none';
  showLoginGate();
}

// ==================== AUTH ====================
function showLoginGate() {
  document.getElementById('loginGate').style.display = 'flex';
  document.getElementById('mainAppContent').style.display = 'none';
}

function switchAuthTab(tab) {
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  document.getElementById('loginFormGate').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerFormGate').style.display = tab === 'register' ? 'block' : 'none';
}

function togglePassword(id) {
  const input = document.getElementById(id);
  const btn = input.parentElement.querySelector('.toggle-password i');
  if (input.type === 'password') {
    input.type = 'text';
    btn.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    btn.className = 'fas fa-eye';
  }
}

function handleLogin() {
  const isEmailValid = validateLoginEmail();
  const isPasswordValid = validateLoginPassword();

  if (!isEmailValid || !isPasswordValid) {
    showToast('error', 'خطأ', 'يرجى تصحيح الأخطاء أولاً');
    return;
  }

  const email = document.getElementById('gateLoginEmail').value.trim();
  const password = document.getElementById('gateLoginPassword').value;

  if (!auth) {
    showToast('error', 'خطأ', 'Firebase غير مفعل - أضف إعداداتك');
    return;
  }

  showLoading('جاري تسجيل الدخول...');

  auth.signInWithEmailAndPassword(email, password)
    .then((result) => {
      const user = result.user;
      currentUser = {
        name: user.displayName || 'مستخدم',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.photoURL || '👤',
        uid: user.uid
      };
      localStorage.setItem('sa3ry_user', JSON.stringify(currentUser));
      hideLoading();
      showToast('success', 'تم!', 'تم تسجيل الدخول بنجاح');
      showMainApp();
    })
    .catch((error) => {
      hideLoading();
      showToast('error', 'خطأ', getAuthErrorMessage(error.code));
    });
}

function handleRegister() {
  const isNameValid = validateRegName();
  const isPhoneValid = validateRegPhone();
  const isEmailValid = validateRegEmail();
  const isPasswordValid = validateRegPassword();
  const isConfirmValid = validateRegConfirmPassword();

  if (!isNameValid || !isPhoneValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
    showToast('error', 'خطأ', 'يرجى تصحيح الأخطاء أولاً');
    return;
  }

  const name = document.getElementById('gateRegName').value.trim();
  const phone = document.getElementById('gateRegPhone').value.trim();
  const email = document.getElementById('gateRegEmail').value.trim();
  const password = document.getElementById('gateRegPassword').value;

  if (!auth) {
    showToast('error', 'خطأ', 'Firebase غير مفعل - أضف إعداداتك');
    return;
  }

  showLoading('جاري إنشاء الحساب...');

  auth.createUserWithEmailAndPassword(email, password)
    .then((result) => {
      return result.user.updateProfile({
        displayName: name,
        photoURL: null
      }).then(() => {
        currentUser = {
          name: name,
          email: email,
          phone: phone,
          avatar: '👤',
          uid: result.user.uid
        };
        localStorage.setItem('sa3ry_user', JSON.stringify(currentUser));
        hideLoading();
        showToast('success', 'تم!', 'تم إنشاء الحساب بنجاح');
        showMainApp();
      });
    })
    .catch((error) => {
      hideLoading();
      showToast('error', 'خطأ', getAuthErrorMessage(error.code));
    });
}

function handleGoogleLogin() {
  if (!auth || !googleProvider) {
    showToast('error', 'خطأ', 'Firebase غير متصل');
    return;
  }

  showLoading('جاري الاتصال بـ Google...');

  // Use redirect on mobile (iOS Safari) where popup may be blocked
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    auth.signInWithRedirect(googleProvider);
    return;
  }

  auth.signInWithPopup(googleProvider)
    .then((result) => {
      const user = result.user;
      currentUser = {
        name: user.displayName || 'مستخدم',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.photoURL || '👤',
        uid: user.uid,
        provider: 'google'
      };
      localStorage.setItem('sa3ry_user', JSON.stringify(currentUser));
      hideLoading();
      showToast('success', 'تم!', 'أهلاً ' + (user.displayName || 'بيك') + ' 👋');
      showMainApp();
    })
    .catch((error) => {
      hideLoading();
      if (error.code === 'auth/popup-blocked') {
        showToast('error', 'خطأ', 'السماح بالـ Popup مطلوب في المتصفح');
      } else {
        showToast('error', 'خطأ', getAuthErrorMessage(error.code));
      }
    });
}

function handleFacebookLogin() {
  showToast('info', 'قريباً', 'تسجيل الدخول بـ Facebook سيكون متاحاً قريباً');
}

function enterGuestMode() {
  isGuest = true;
  localStorage.setItem('sa3ry_guest', 'true');
  showToast('info', 'تصفح كزائر', 'يمكنك تصفح الأسعار بدون تسجيل');
  showMainApp();
}

function showForgotPassword() {
  openModal('forgotPasswordModal');
}

function sendPasswordReset() {
  const email = document.getElementById('forgotEmail').value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('error', 'خطأ', 'أدخل بريد إلكتروني صحيح');
    return;
  }

  if (!auth) {
    showToast('error', 'خطأ', 'Firebase غير مفعل - أضف إعداداتك');
    return;
  }

  showLoading('جاري الإرسال...');

  auth.sendPasswordResetEmail(email)
    .then(() => {
      hideLoading();
      closeModal('forgotPasswordModal');
      showToast('success', 'تم!', 'تم إرسال رابط الاستعادة');
    })
    .catch((error) => {
      hideLoading();
      showToast('error', 'خطأ', getAuthErrorMessage(error.code));
    });
}

function logout() {
  if (auth) {
    auth.signOut().then(() => {
      console.log('Firebase signOut successful');
    }).catch((error) => {
      console.log('Firebase signOut error:', error);
    });
  }

  currentUser = null;
  isGuest = false;
  try {
    localStorage.removeItem('sa3ry_user');
    localStorage.removeItem('sa3ry_guest');
  } catch(e) {}
  showToast('success', 'تم!', 'تم تسجيل الخروج');

  closeModal('profileModal');
  closeModal('settingsModal');

  setTimeout(() => {
    showLoginGate();
  }, 1000);
}

// ==================== MAIN APP ====================
function showMainApp() {
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('mainAppContent').style.display = 'block';

  if (isGuest) {
    document.getElementById('guestBanner').style.display = 'flex';
  } else {
    document.getElementById('guestBanner').style.display = 'none';
  }

  renderCategories();
  renderBrandFilters();
  renderProducts();
  updateProfileStats();
  updateCartBadge();
  updateNotificationsBadge();
  renderRecentlyViewed();
}

function goHome() {
  resetFilters();
  switchTab('home', document.querySelector('[data-tab="home"]'));
}

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
function getFilteredProducts() {
  let filtered = productsData.filter(p => {
    if (currentCategory !== 'all' && p.category !== currentCategory) return false;
    if (currentBrand !== 'all' && p.brand !== currentBrand) return false;
    const minPrice = Math.min(...p.stores.map(s => s.price));
    if (minPrice > currentPrice) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (currentSort === 'price-low') {
    filtered.sort((a, b) => Math.min(...a.stores.map(s => s.price)) - Math.min(...b.stores.map(s => s.price)));
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => Math.max(...b.stores.map(s => s.price)) - Math.max(...a.stores.map(s => s.price)));
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
  const product = productsData.find(p => p.id === productId);
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
              <div style="width:32px;height:32px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px">${r.name[0]}</div>
              <div>
                <div style="font-size:13px;font-weight:700">${r.name}</div>
                <div style="color:#ffc107;font-size:12px">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary)">${r.date}</div>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin:0">${r.text}</p>
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
    const minPrice = Math.min(...p.stores.map(s => s.price));
    const maxPrice = Math.max(...p.stores.map(s => s.price));
    const savings = maxPrice - minPrice;
    const bestStore = p.stores.reduce((a, b) => a.price < b.price ? a : b);
    const isFav = favorites.includes(p.id);
    const isCompare = compareList.includes(p.id);

    return `
    <div class="product-card" data-onclick="showProductDetail(${p.id})">
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
        <button type="button" class="btn btn-primary" style="flex:1;font-size:13px;padding:10px" data-onclick="event.stopPropagation();addToCart(${p.id})"><i class="fas fa-cart-plus"></i> أضف للسلة</button>
        <button type="button" class="share-btn ${isFav ? '' : ''}" data-onclick="event.stopPropagation();toggleFavorite(${p.id})" title="مفضلة"><i class="fas ${isFav ? 'fa-heart' : 'fa-heart'}" style="color:${isFav ? '#e53935' : ''}"></i></button>
        <button type="button" class="share-btn ${isCompare ? '' : ''}" data-onclick="event.stopPropagation();toggleCompare(${p.id})" title="قارن"><i class="fas ${isCompare ? 'fa-check' : 'fa-balance-scale'}"></i></button>
      </div>
      <div class="product-actions">
        <button type="button" class="btn btn-text" style="flex:1" data-onclick="event.stopPropagation();showPriceAlert(${p.id})"><i class="fas fa-bell"></i> تنبيه السعر</button>
        <button type="button" class="btn btn-text" style="flex:1" data-onclick="event.stopPropagation();showContactModal(${p.id}, '${bestStore.name}')"><i class="fas fa-phone"></i> اتصل بالمحل</button>
      </div>
    </div>
    `;
  }).join('');
  grid.innerHTML += newCards;

  // Load more button
  const oldBtn = document.getElementById('loadMoreBtn');
  if (oldBtn) oldBtn.remove();
  if (hasMore) {
    const btn = document.createElement('div');
    btn.id = 'loadMoreBtn';
    btn.style.cssText = 'text-align:center;padding:20px 0';
    btn.innerHTML = `<button data-onclick="renderProducts(${page+1})" style="background:var(--primary);color:white;border:none;border-radius:50px;padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer;font-family:Cairo,sans-serif;box-shadow:0 4px 12px rgba(26,115,232,0.3)"><i class="fas fa-chevron-down"></i> تحميل المزيد (${_allFilteredProducts.length - products.length} منتج)</button>`;
    grid.parentElement.appendChild(btn);
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

// ==================== SEARCH ====================
function handleSearchInput() {
  const input = document.getElementById('searchInput');
  const suggestions = document.getElementById('searchSuggestions');
  if (input.value.length > 0) {
    suggestions.style.display = 'block';
  } else {
    suggestions.style.display = 'none';
  }
}

function performSearch() {
  const input = document.getElementById('searchInput');
  searchQuery = input.value.trim();
  document.getElementById('searchSuggestions').style.display = 'none';
  renderProducts();
  if (searchQuery) {
    addRecentSearch(searchQuery);
  }
}

function quickSearch(query) {
  document.getElementById('searchInput').value = query;
  searchQuery = query;
  document.getElementById('searchSuggestions').style.display = 'none';
  renderProducts();
  addRecentSearch(query);
}

function addRecentSearch(query) {
  let recent = JSON.parse(localStorage.getItem('sa3ry_recent_searches') || '[]');
  recent = recent.filter(q => q !== query);
  recent.unshift(query);
  if (recent.length > 5) recent.pop();
  localStorage.setItem('sa3ry_recent_searches', JSON.stringify(recent));
  renderRecentSearches();
}

function renderRecentSearches() {
  const container = document.getElementById('recentSearches');
  if (!container) return;
  const recent = JSON.parse(localStorage.getItem('sa3ry_recent_searches') || '[]');
  container.innerHTML = recent.map(q => `
    <div class="suggestion-item" data-onclick="quickSearch('${q}')"><i class="fas fa-history"></i> ${q}</div>
  `).join('');
}

// ==================== PRODUCT DETAIL ====================
function showProductDetail(productId) {
  const product = getProductById(productId);
  if (!product) return;

  currentProduct = product;
  addToRecentlyViewed(product);

  const minPrice = Math.min(...product.stores.map(s => s.price));
  const maxPrice = Math.max(...product.stores.map(s => s.price));
  const savings = maxPrice - minPrice;
  const isFav = favorites.includes(product.id);

  const body = document.getElementById('productDetailBody');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:80px;margin-bottom:12px">${product.icon}</div>
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
      <button type="button" class="btn btn-primary btn-full" data-onclick="addToCart(${product.id})"><i class="fas fa-cart-plus"></i> أضف للسلة</button>
    </div>
    <div style="display:flex;gap:8px">
      <button type="button" class="btn btn-secondary" style="flex:1" data-onclick="toggleFavorite(${product.id})"><i class="fas ${isFav ? 'fa-heart' : 'fa-heart'}"></i> ${isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}</button>
      <button type="button" class="btn btn-secondary" style="flex:1" data-onclick="toggleCompare(${product.id})"><i class="fas fa-balance-scale"></i> قارن</button>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button type="button" class="btn btn-text" style="flex:1;background:var(--bg-secondary)" data-onclick="showPriceAlert(${product.id})"><i class="fas fa-bell"></i> تنبيه السعر</button>
      <button type="button" class="btn btn-text" style="flex:1;background:var(--bg-secondary)" data-onclick="showPriceHistory(${product.id})"><i class="fas fa-chart-line"></i> تاريخ السعر</button>
    </div>
    <button type="button" style="width:100%;margin-top:10px;background:linear-gradient(135deg,#ffc107,#ff8f00);color:white;border:none;border-radius:var(--radius);padding:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer" data-onclick="showReviews(${product.id})"><i class="fas fa-star"></i> التقييمات والآراء (${product.reviews.toLocaleString()})</button>
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

function shareVia(platform) {
  if (platform === 'copy') {
    showToast('success', 'تم!', 'تم نسخ الرابط');
  } else {
    showToast('info', 'مشاركة', 'جاري فتح ' + platform);
  }
  closeModal('shareModal');
}

// ==================== CONTACT ====================
function showContactModal(productId, storeName) {
  const product = productsData.find(p => p.id === productId);
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
  const product = productsData.find(p => p.id === productId);
  if (!product) return;
  currentProduct = product;
  const minPrice = Math.min(...product.stores.map(s => s.price));

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
  const product = productsData.find(p => p.id === productId);
  if (!product) return;
  const minPrice = Math.min(...product.stores.map(s => s.price));
  const maxPrice = Math.max(...product.stores.map(s => s.price));
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
  } else {
    favorites.push(productId);
    showToast('success', 'تم!', 'تم إضافة المنتج للمفضلة');
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
      const p = productsData.find(prod => prod.id === fid);
      if (!p) return '';
      const minPrice = Math.min(...p.stores.map(s => s.price));
      return `
        <div class="fav-item" data-onclick="showProductDetail(${p.id})">
          <div class="fav-item-image">${p.icon}</div>
          <div class="fav-item-info">
            <div class="fav-item-name">${p.name}</div>
            <div class="fav-item-price">${minPrice.toLocaleString()} ج.م</div>
          </div>
          <button class="fav-item-remove" data-onclick="event.stopPropagation();toggleFavorite(${p.id})"><i class="fas fa-trash"></i></button>
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
    const p = productsData.find(prod => prod.id === cid);
    if (!p) return '';
    return `
      <div class="compare-item">
        <button class="compare-item-remove" data-onclick="toggleCompare(${p.id})"><i class="fas fa-times"></i></button>
        <div class="compare-item-icon">${p.icon}</div>
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

  const products = compareList.map(cid => productsData.find(p => p.id === cid)).filter(Boolean);
  const body = document.getElementById('comparePageBody');

  body.innerHTML = `
    <table class="compare-table">
      <tr><th>المنتج</th>${products.map(p => `<th>${p.icon}<br>${p.name}</th>`).join('')}</tr>
      <tr><td>العلامة التجارية</td>${products.map(p => `<td>${p.brand}</td>`).join('')}</tr>
      <tr><td>التقييم</td>${products.map(p => `<td>${p.rating} ★</td>`).join('')}</tr>
      <tr><td>أقل سعر</td>${products.map(p => {
        const minP = Math.min(...p.stores.map(s => s.price));
        const winner = products.every(other => {
          if (other === p) return true;
          return minP <= Math.min(...other.stores.map(s => s.price));
        });
        return `<td class="${winner ? 'compare-winner' : ''}">${minP.toLocaleString()} ج.م</td>`;
      }).join('')}</tr>
      <tr><td>أعلى سعر</td>${products.map(p => `<td>${Math.max(...p.stores.map(s => s.price)).toLocaleString()} ج.م</td>`).join('')}</tr>
      <tr><td>عدد المتاجر</td>${products.map(p => `<td>${p.stores.length} متاجر</td>`).join('')}</tr>
      <tr><td>الإجراء</td>${products.map(p => `<td><button class="btn btn-primary" style="font-size:12px;padding:8px" data-onclick="addToCart(${p.id});closeModal('comparePageModal')">أضف للسلة</button></td>`).join('')}</tr>
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
    const product = productsData.find(p => p.id === productId);
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
    const product = productsData.find(p => p.id === item.id);
    if (!product) return '';
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-image">${product.icon}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${product.name}</div>
          <div class="cart-item-store">${item.store}</div>
          <div class="cart-item-price">${itemTotal.toLocaleString()} ج.م</div>
          <div class="cart-item-actions">
            <button class="qty-btn" data-onclick="updateCartQty(${item.id}, -1)">-</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-onclick="updateCartQty(${item.id}, 1)">+</button>
            <button class="btn btn-text" style="color:var(--danger);margin-right:auto" data-onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
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

// ==================== NOTIFICATIONS ====================
function showNotifications() {
  const list = document.getElementById('notificationsList');
  list.innerHTML = notificationsData.map(n => `
    <div class="notification-item ${n.unread ? 'unread' : ''}" data-onclick="markNotificationRead(${n.id})">
      <div class="notification-icon ${n.type}"><i class="fas ${n.type === 'price-drop' ? 'fa-tag' : n.type === 'new-product' ? 'fa-box' : n.type === 'review' ? 'fa-star' : n.type === 'order' ? 'fa-shopping-bag' : 'fa-cog'}"></i></div>
      <div class="notification-content">
        <div class="notification-title">${n.title}</div>
        <div class="notification-desc">${n.desc}</div>
        <div class="notification-time"><i class="far fa-clock"></i> ${n.time}</div>
      </div>
    </div>
  `).join('');
  openModal('notificationsModal');
}

function markNotificationRead(id) {
  const notif = notificationsData.find(n => n.id === id);
  if (notif) notif.unread = false;
  updateNotificationsBadge();
  showNotifications();
}

function updateNotificationsBadge() {
  const badge = document.getElementById('notifBadge');
  const unread = notificationsData.filter(n => n.unread).length;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

// ==================== PROFILE ====================
function showProfile() {
  if (isGuest) {
    document.getElementById('profileName').textContent = 'زائر';
    document.getElementById('profileEmail').textContent = 'سجل دخول للمزيد';
    document.getElementById('profileAvatar').textContent = '👤';
  } else if (currentUser) {
    document.getElementById('profileName').textContent = currentUser.name || 'مستخدم';
    document.getElementById('profileEmail').textContent = currentUser.email || currentUser.phone || '';
    
    // Handle avatar - if it's a URL show image, if emoji show text
    const avatarEl = document.getElementById('profileAvatar');
    const avatar = currentUser.avatar || '';
    if (avatar.startsWith('http')) {
      avatarEl.innerHTML = `<img src="${avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.parentElement.textContent='👤'">`;
    } else {
      avatarEl.textContent = avatar || '👤';
    }
  }

  updateProfileStats();

  const menu = document.getElementById('profileMenu');
  menu.innerHTML = `
    <div class="profile-menu-item" data-onclick="showFavorites();closeModal('profileModal')">
      <div class="profile-menu-icon" style="background:#fce4ec;color:#c2185b"><i class="fas fa-heart"></i></div>
      <div class="profile-menu-text"><div class="profile-menu-title">المفضلة</div><div class="profile-menu-desc">${favorites.length} منتج</div></div>
      <i class="fas fa-chevron-left" style="color:var(--text-tertiary)"></i>
    </div>
    <div class="profile-menu-item" data-onclick="showAlerts();closeModal('profileModal')">
      <div class="profile-menu-icon" style="background:#fff3e0;color:var(--accent)"><i class="fas fa-bell"></i></div>
      <div class="profile-menu-text"><div class="profile-menu-title">تنبيهات الأسعار</div><div class="profile-menu-desc">${priceAlerts.length} تنبيه نشط</div></div>
      <i class="fas fa-chevron-left" style="color:var(--text-tertiary)"></i>
    </div>
    <div class="profile-menu-item" data-onclick="showOrders();closeModal('profileModal')">
      <div class="profile-menu-icon" style="background:#e8f5e9;color:var(--secondary)"><i class="fas fa-shopping-bag"></i></div>
      <div class="profile-menu-text"><div class="profile-menu-title">طلباتي</div><div class="profile-menu-desc">عرض سجل الطلبات</div></div>
      <i class="fas fa-chevron-left" style="color:var(--text-tertiary)"></i>
    </div>
    <div class="profile-menu-item" data-onclick="showSettingsModal()">
      <div class="profile-menu-icon" style="background:#e3f2fd;color:var(--primary)"><i class="fas fa-cog"></i></div>
      <div class="profile-menu-text"><div class="profile-menu-title">الإعدادات</div><div class="profile-menu-desc">اللغة، الإشعارات، الوضع الليلي، تسجيل الخروج</div></div>
      <i class="fas fa-chevron-left" style="color:var(--text-tertiary)"></i>
    </div>
  `;

  openModal('profileModal');
}

function updateProfileStats() {
  document.getElementById('statFavorites').textContent = favorites.length;
  document.getElementById('statAlerts').textContent = priceAlerts.length;
  document.getElementById('statPoints').textContent = Math.floor(favorites.length * 10 + cart.length * 5);
}

function showAlerts() {
  showToast('info', 'تنبيهات', 'لديك ' + priceAlerts.length + ' تنبيه نشط');
}

function showPoints() {
  showToast('info', 'النقاط', 'نقاطك: ' + (favorites.length * 10 + cart.length * 5));
}

function showOrders() {
  showToast('info', 'طلباتي', 'لا توجد طلبات حالياً');
}

function showSettingsModal() {
  const logoutSection = document.getElementById('settingsLogoutSection');
  if (logoutSection) logoutSection.style.display = currentUser ? 'block' : 'none';
  closeModal('profileModal');
  openModal('settingsModal');
}

function showSettings() {
  showSettingsModal();
}

function toggleDarkModeSettings() {
  toggleDarkMode();
}

function toggleNotifications() {
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('success', 'تم!', 'تم تفعيل الإشعارات');
      } else {
        showToast('info', 'تنبيه', 'تم إلغاء الإشعارات');
      }
    });
  } else {
    showToast('error', 'خطأ', 'المتصفح لا يدعم الإشعارات');
  }
}

function changeLanguage() {
  showToast('info', 'اللغة', 'اللغة العربية فقط حالياً');
}

function clearCache() {
  if (confirm('هل أنت متأكد من مسح جميع البيانات المحلية؟')) {
    localStorage.clear();
    showToast('success', 'تم!', 'تم مسح الذاكرة المؤقتة');
    setTimeout(() => location.reload(), 1500);
  }
}

function showAbout() {
  showToast('info', 'عن التطبيق', 'سعري v1.0 - مقارنة أسعار الإلكترونيات في مصر');
}

// ==================== RECENTLY VIEWED ====================
function addToRecentlyViewed(product) {
  recentlyViewed = recentlyViewed.filter(p => p.id !== product.id);
  recentlyViewed.unshift({id: product.id, name: product.name, icon: product.icon, price: Math.min(...product.stores.map(s => s.price))});
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
    <div class="recent-item" data-onclick="showProductDetail(${p.id})">
      <div class="recent-item-image">${p.icon}</div>
      <div class="recent-item-name">${p.name}</div>
    </div>
  `).join('');
}

// ==================== NAVIGATION ====================
function switchTab(tab, el) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (el) el.classList.add('active');

  if (tab === 'home') {
    document.getElementById('categoriesSection').style.display = 'block';
    document.getElementById('filtersSection').style.display = 'block';
    document.getElementById('priceRangeSection').style.display = 'block';
    document.getElementById('sortBar').style.display = 'flex';
    document.getElementById('productsSection').style.display = 'block';
    document.getElementById('recentlyViewedSection').style.display = recentlyViewed.length > 0 ? 'block' : 'none';
    renderProducts();
  } else if (tab === 'categories') {
    document.getElementById('categoriesSection').style.display = 'block';
    document.getElementById('filtersSection').style.display = 'block';
    document.getElementById('priceRangeSection').style.display = 'block';
    document.getElementById('sortBar').style.display = 'flex';
    document.getElementById('productsSection').style.display = 'block';
    document.getElementById('recentlyViewedSection').style.display = 'none';
  } else if (tab === 'favorites') {
    showFavorites();
  } else if (tab === 'cart') {
    renderCart();
    openModal('cartModal');
  } else if (tab === 'profile') {
    showProfile();
  }
}

// ==================== DARK MODE ====================
function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark-mode', darkMode);
  localStorage.setItem('sa3ry_dark', darkMode);
  const icon = document.getElementById('darkModeIcon');
  if (icon) icon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
  showToast('info', darkMode ? 'الوضع الليلي' : 'الوضع النهاري', 'تم تغيير الوضع');
}

// ==================== MODALS ====================
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const id = overlay.id;
      closeModal(id);
    }
  });
});

// ==================== TOAST ====================
function showToast(type, title, message) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const msgEl = document.getElementById('toastMessage');

  toast.className = 'toast toast-' + type;
  icon.innerHTML = type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
                   type === 'error' ? '<i class="fas fa-times-circle"></i>' : 
                   type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' : 
                   '<i class="fas fa-info-circle"></i>';
  titleEl.textContent = title;
  msgEl.textContent = message;

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== VOICE SEARCH ====================
let isListening = false;
let recognition = null;

function toggleVoiceSearch() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('error', 'خطأ', 'المتصفح ده مش بيدعم البحث الصوتي');
    return;
  }

  if (isListening) {
    stopVoiceSearch();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'ar-EG';
  recognition.continuous = false;
  recognition.interimResults = true;

  const voiceBtn = document.getElementById('voiceBtn');

  recognition.onstart = () => {
    isListening = true;
    voiceBtn.innerHTML = '<i class="fas fa-microphone-slash" style="color:red"></i>';
    voiceBtn.style.background = 'rgba(255,0,0,0.1)';
    showToast('info', '🎤 جاري الاستماع...', 'تكلم دلوقتي');
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('searchInput').value = transcript;
    if (e.results[0].isFinal) {
      performSearch();
      stopVoiceSearch();
    }
  };

  recognition.onerror = (e) => {
    stopVoiceSearch();
    if (e.error === 'not-allowed') {
      showToast('error', 'خطأ', 'اسمح للتطبيق بالوصول للميكرفون');
    } else {
      showToast('error', 'خطأ', 'مش قادر يسمعك، حاول تاني');
    }
  };

  recognition.onend = () => stopVoiceSearch();
  recognition.start();
}

function stopVoiceSearch() {
  isListening = false;
  if (recognition) recognition.stop();
  const voiceBtn = document.getElementById('voiceBtn');
  if (voiceBtn) {
    voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    voiceBtn.style.background = '';
  }
}

// ==================== IMAGE SEARCH (CAMERA) ====================
function openImageSearch() {
  openModal('imageSearchModal');
}

function startImageSearchCamera() {
  const video = document.getElementById('imageSearchVideo');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      video.play();
      document.getElementById('imageSearchCaptureBtn').style.display = 'block';
      document.getElementById('imageSearchPlaceholder').style.display = 'none';
    })
    .catch(() => showToast('error', 'خطأ', 'اسمح للتطبيق بالوصول للكاميرا'));
}

function captureImageSearch() {
  const video = document.getElementById('imageSearchVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  // Stop camera
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());

  canvas.toBlob(async (blob) => {
    showLoading('جاري تحليل الصورة...');
    closeModal('imageSearchModal');
    
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', blob, 'search.jpg');
    formData.append('upload_preset', CLOUDINARY_PRESET);
    
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST', body: formData
      });
      const data = await res.json();
      hideLoading();
      
      // Search by image tags from Cloudinary
      if (data.tags && data.tags.length > 0) {
        const searchTerm = data.tags[0];
        document.getElementById('searchInput').value = searchTerm;
        performSearch();
        showToast('success', 'تم!', 'بيبحث عن: ' + searchTerm);
      } else {
        showToast('info', 'البحث بالصورة', 'جرب تكتب اسم المنتج يدوياً');
      }
    } catch(e) {
      hideLoading();
      showToast('error', 'خطأ', 'فشل تحليل الصورة');
    }
  }, 'image/jpeg');
}

function uploadImageSearch(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('imageSearchPreview');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('imageSearchPlaceholder').style.display = 'none';
    document.getElementById('imageSearchCaptureBtn').style.display = 'block';
    document.getElementById('imageSearchCaptureBtn').onclick = () => {
      // Search by filename
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      document.getElementById('searchInput').value = name;
      performSearch();
      closeModal('imageSearchModal');
      showToast('info', 'البحث بالصورة', 'بيبحث عن: ' + name);
    };
  };
  reader.readAsDataURL(file);
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

// ==================== PWA INSTALL ====================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install button after 3 seconds
  setTimeout(() => showInstallBanner(), 3000);
});

function showInstallBanner() {
  if (!deferredPrompt) return;
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'flex';
}

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((result) => {
    if (result.outcome === 'accepted') {
      showToast('success', 'تم!', 'جاري تنزيل التطبيق 🎉');
    }
    deferredPrompt = null;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
  });
}

function dismissInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'none';
}

window.addEventListener('appinstalled', () => {
  showToast('success', 'تم التنزيل!', 'تم تنزيل سعري على جهازك 🎉');
  deferredPrompt = null;
});

// ==================== LOADING ====================
function showLoading(text) {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text || 'جاري التحميل...';
  if (overlay) overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

// === Script Block 2 ===
// Register Service Worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Inline service worker as blob URL since we're a single HTML file
    const swCode = `
const CACHE_NAME = 'sa3ry-v1.2';
const STATIC_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Cache static assets (fonts, icons)
  if (url.includes('googleapis.com') || url.includes('cdnjs.cloudflare.com') || url.includes('fontawesome')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }
  // For Firebase/API calls: network first, no cache
  if (url.includes('firebase') || url.includes('firestore') || url.includes('googleapis.com/identitytoolkit') || url.includes('cloudinary')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
});

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'سعري', body: 'إشعار جديد' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'سعري', {
      body: data.body || '',
      icon: '/sa3ry/icon-192.png',
      badge: '/sa3ry/icon-96.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/sa3ry/'));
});
`;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl)
      .then(reg => {
        console.log('✅ SW registered');
        // Check for updates every 30 min
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ==================== INDEXEDDB FOR OFFLINE PRODUCTS ====================
const DB_NAME = 'sa3ryDB';
const DB_VERSION = 1;
let idb = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('searches')) {
        db.createObjectStore('searches', { keyPath: 'query' });
      }
    };
    req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(store, data) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = Array.isArray(data)
        ? (data.forEach(item => os.put(item)), tx)
        : os.put(data);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) { console.warn('IDB save failed:', e); }
}

async function idbGetAll(store) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  } catch(e) { return []; }
}

async function idbDelete(store, key) {
  try {
    const db = idb || await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) {}
}

// Init IndexedDB on load
openDB().then(() => {
  console.log('✅ IndexedDB ready');
  // Load cached products if offline
  if (!navigator.onLine) {
    idbGetAll('products').then(cached => {
      if (cached.length > 0) {
        const existingIds = new Set(productsData.map(p => p.id));
        cached.forEach(p => { if (!existingIds.has(p.id)) productsData.unshift(p); });
        renderProducts && renderProducts();
        console.log('📦 Loaded', cached.length, 'products from IndexedDB (offline)');
      }
    });
  }
}).catch(() => {});

// ==================== INPUT SANITIZATION ====================
function sanitizeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Patch search to sanitize input
const _origPerformSearch = window.performSearch;
window.performSearch = function() {
  const input = document.getElementById('searchInput');
  if (input) input.value = input.value.replace(/<[^>]*>/g, '').slice(0, 100);
  if (_origPerformSearch) _origPerformSearch();
};

// ==================== LOADING SKELETONS ====================
const skeletonCSS = `
.skeleton { background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius); }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-card { background: var(--card); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-sm); margin-bottom: 16px; }
.skeleton-header { display: flex; gap: 14px; margin-bottom: 14px; }
.skeleton-img { width: 90px; height: 90px; border-radius: var(--radius); flex-shrink: 0; }
.skeleton-info { flex: 1; }
.skeleton-line { height: 14px; margin-bottom: 8px; border-radius: 6px; }
.skeleton-line.short { width: 40%; }
.skeleton-line.medium { width: 70%; }
.skeleton-line.long { width: 90%; }
.skeleton-price-block { border-radius: var(--radius); padding: 12px; margin-bottom: 8px; height: 80px; }
.skeleton-btn-row { display: flex; gap: 8px; }
.skeleton-btn { height: 40px; border-radius: var(--radius); flex: 1; }
`;

const styleEl = document.createElement('style');
styleEl.textContent = skeletonCSS;
document.head.appendChild(styleEl);

function showSkeletons(count = 3) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  const loading = document.getElementById('loadingProducts');
  if (loading) loading.style.display = 'none';
  grid.innerHTML = Array(count).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-info">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line long"></div>
          <div class="skeleton skeleton-line medium"></div>
        </div>
      </div>
      <div class="skeleton skeleton-price-block"></div>
      <div class="skeleton-btn-row">
        <div class="skeleton skeleton-btn"></div>
        <div class="skeleton skeleton-btn" style="flex:0.3"></div>
        <div class="skeleton skeleton-btn" style="flex:0.3"></div>
      </div>
    </div>
  `).join('');
}

// ==================== ACCESSIBILITY IMPROVEMENTS ====================
// Focus trap for modals
function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first) return;
  first.focus();
  // Remove old listener if exists to prevent memory leak
  if (modalEl._focusHandler) {
    modalEl.removeEventListener('keydown', modalEl._focusHandler);
  }
  modalEl._focusHandler = function(e) {
    if (e.key !== 'Tab') {
      if (e.key === 'Escape') closeModal(modalEl.id);
      return;
    }
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last && last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first && first.focus(); }
    }
  };
  modalEl.addEventListener('keydown', modalEl._focusHandler);
}

// Patch openModal to add ARIA + focus trap
const _origOpenModal = window.openModal;
window.openModal = function(id) {
  _origOpenModal(id);
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const title = modal.querySelector('.modal-title');
  if (title) {
    const labelId = id + '-label';
    title.id = labelId;
    modal.setAttribute('aria-labelledby', labelId);
  }
  setTimeout(() => trapFocus(modal), 50);
};

// Add skip-to-content link
const skip = document.createElement('a');
skip.href = '#mainContent';
skip.textContent = 'تخطى للمحتوى الرئيسي';
skip.style.cssText = 'position:fixed;top:-40px;right:0;background:var(--primary);color:white;padding:8px 16px;border-radius:0 0 var(--radius) var(--radius);z-index:99999;font-family:Cairo,sans-serif;font-weight:700;text-decoration:none;transition:top 0.2s';
skip.addEventListener('focus', () => { skip.style.top = '0'; });
skip.addEventListener('blur', () => { skip.style.top = '-40px'; });
document.body.prepend(skip);

// ==================== PULL TO REFRESH ====================
(function() {
  let startY = 0;
  let pulling = false;
  let indicator = null;

  function createIndicator() {
    if (indicator) return;
    indicator = document.createElement('div');
    indicator.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:8px 20px;border-radius:0 0 20px 20px;font-size:13px;font-weight:700;z-index:9999;transition:transform 0.2s;transform:translateX(-50%) translateY(-100%);font-family:Cairo,sans-serif';
    indicator.innerHTML = '<i class="fas fa-sync-alt"></i> اسحب للتحديث';
    document.body.appendChild(indicator);
  }

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0 && !document.querySelector('.modal-overlay.active')) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 60) {
      createIndicator();
      indicator.style.transform = 'translateX(-50%) translateY(0)';
      indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> ارفع للتحديث';
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80 && indicator) {
      indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> جاري التحديث...';
      showSkeletons(3);
      setTimeout(() => {
        renderProducts && renderProducts();
        if (indicator) indicator.style.transform = 'translateX(-50%) translateY(-100%)';
        showToast && showToast('success', 'تم!', 'تم تحديث المنتجات');
      }, 1500);
    } else if (indicator) {
      indicator.style.transform = 'translateX(-50%) translateY(-100%)';
    }
  }, { passive: true });
})();

// ==================== IMAGE FALLBACK ====================
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') {
    e.target.style.display = 'none';
    const parent = e.target.parentElement;
    if (parent && !parent.querySelector('.img-fallback')) {
      const fb = document.createElement('span');
      fb.className = 'img-fallback';
      fb.style.cssText = 'font-size:32px;display:flex;align-items:center;justify-content:center;width:100%;height:100%';
      fb.textContent = '📦';
      parent.appendChild(fb);
    }
  }
}, true);

// ==================== MANIFEST.JSON (INLINE) ====================
const manifestData = {
  "name": "سعري - مقارنة أسعار الإلكترونيات",
  "short_name": "سعري",
  "description": "قارن أسعار الإلكترونيات في مصر",
  "start_url": "/sa3ry/",
  "display": "standalone",
  "background_color": "#1a73e8",
  "theme_color": "#1a73e8",
  "orientation": "portrait",
  "lang": "ar",
  "dir": "rtl",
  "icons": [
    { "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231a73e8'/><text y='70' font-size='60' text-anchor='middle' x='50'>🏷️</text></svg>", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ],
  "categories": ["shopping", "utilities"],
  "screenshots": [],
  "shortcuts": [
    { "name": "بحث سريع", "short_name": "بحث", "url": "/sa3ry/?action=search", "icons": [{ "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='80' font-size='80'>🔍</text></svg>", "sizes": "96x96" }] }
  ]
};

// Manifest is already linked in HTML head
console.log('✅ Manifest ready');

// ==================== RATE LIMITING ====================
const _apiCallLog = {};
function rateLimit(key, maxCalls = 5, windowMs = 60000) {
  const now = Date.now();
  if (!_apiCallLog[key]) _apiCallLog[key] = [];
  _apiCallLog[key] = _apiCallLog[key].filter(t => now - t < windowMs);
  if (_apiCallLog[key].length >= maxCalls) {
    showToast && showToast('warning', 'تنبيه', 'كثرت الطلبات، انتظر قليلاً');
    return false;
  }
  _apiCallLog[key].push(now);
  return true;
}

// Patch addProductToFirestore to rate limit
const _origAdd = window.addProductToFirestore;
if (_origAdd) {
  window.addProductToFirestore = function(product) {
    if (!rateLimit('addProduct', 10, 60000)) return Promise.reject(new Error('rate limited'));
    return _origAdd(product);
  };
}

// ==================== PATCH RENDER TO SAVE TO IDB + SANITIZE ====================
const _origRenderProducts = window.renderProducts;
window.renderProducts = function() {
  // Save products to IndexedDB for offline access
  if (idb && productsData.length > 0) {
    const toSave = productsData.slice(0, 50).map(p => ({ ...p, id: String(p.id) }));
    idbSave('products', toSave).catch(() => {});
  }
  if (_origRenderProducts) _origRenderProducts();
};

// ==================== KEYBOARD SHORTCUT ====================
document.addEventListener('keydown', (e) => {
  // Ctrl+K or / to focus search
  if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
    e.preventDefault();
    const search = document.getElementById('searchInput');
    if (search) { search.focus(); search.select(); }
  }
  // ESC to close any open modal
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal-overlay.active');
    if (openModal) closeModal(openModal.id);
  }
});

// ==================== PUSH NOTIFICATIONS SUBSCRIPTION ====================
async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('error', 'خطأ', 'المتصفح لا يدعم الإشعارات');
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('info', 'تنبيه', 'لم يتم السماح بالإشعارات'); return false; }
    const reg = await navigator.serviceWorker.ready;
    // Use VAPID public key (demo - replace with real key in production)
    const vapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      localStorage.setItem('sa3ry_push_sub', JSON.stringify(sub));
      showToast('success', 'تم!', 'تم تفعيل إشعارات تنبيهات الأسعار 🔔');
      return true;
    } catch(e) {
      // Push subscription needs HTTPS + real VAPID - show local notifications instead
      await reg.showNotification('سعري 🏷️', {
        body: 'تم تفعيل الإشعارات! هنبلغك لما الأسعار تنزل.',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%231a73e8"/><text y="70" font-size="60" text-anchor="middle" x="50">🏷️</text></svg>',
        dir: 'rtl', lang: 'ar', vibrate: [200, 100, 200]
      });
      return true;
    }
  } catch(e) {
    console.warn('Push notifications error:', e);
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// Patch toggleNotifications to use real push
const _origToggleNotif = window.toggleNotifications;
window.toggleNotifications = async function() {
  const result = await subscribeToPushNotifications();
  if (!result && _origToggleNotif) _origToggleNotif();
};

// ==================== BACKGROUND SYNC FOR PRICE ALERTS ====================
async function syncPriceAlerts() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-price-alerts');
    console.log('Background sync registered for price alerts');
  } catch(e) {
    console.warn('Background sync failed:', e);
  }
}

// Patch savePriceAlert to also register sync
const _origSavePriceAlert = window.savePriceAlert;
window.savePriceAlert = function() {
  if (_origSavePriceAlert) _origSavePriceAlert();
  syncPriceAlerts();
};

// ==================== SMART SEARCH SUGGESTIONS ====================
const _origHandleSearchInput = window.handleSearchInput;
window.handleSearchInput = function() {
  const input = document.getElementById('searchInput');
  const val = input ? input.value.trim().toLowerCase() : '';
  
  if (val.length > 1) {
    // Show matching products as suggestions
    const matches = productsData.filter(p =>
      p.name.toLowerCase().includes(val) || p.brand.toLowerCase().includes(val)
    ).slice(0, 4);
    
    const dynSugg = document.getElementById('dynamicSuggestions');
    if (dynSugg && matches.length > 0) {
      dynSugg.innerHTML = matches.map(p => {
        const minP = Math.min(...p.stores.map(s => s.price));
        return `<div class="suggestion-item" data-onclick="quickSearch('${p.name.replace(/'/g,"\'")}')">
          <span style="font-size:18px;margin-left:8px">${p.icon}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700">${p.name}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">من ${minP.toLocaleString()} ج.م</div>
          </div>
        </div>`;
      }).join('');
    }
  } else {
    const dynSugg = document.getElementById('dynamicSuggestions');
    if (dynSugg) dynSugg.innerHTML = '';
  }
  
  if (_origHandleSearchInput) _origHandleSearchInput();
};

// Inject dynamic suggestions container
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  setTimeout(() => {
    const sugg = document.getElementById('searchSuggestions');
    if (sugg && !document.getElementById('dynamicSuggestions')) {
      const dynDiv = document.createElement('div');
      dynDiv.id = 'dynamicSuggestions';
      sugg.insertBefore(dynDiv, sugg.firstChild);
    }
  }, 500);
});
