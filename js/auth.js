// ==================== AUTH.JS ====================
// Login, registration, Google login, phone/OTP auth, password reset, logout,
// and all form-validation helpers for the auth screens.
// Depends on: firebase.js (auth, googleProvider, recaptchaVerifier).
'use strict';

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
  if (!auth || !facebookProvider) {
    showToast('error', 'خطأ', 'Firebase غير متصل');
    return;
  }

  showLoading('جاري الاتصال بـ Facebook...');

  // Use redirect on mobile (iOS Safari) where popup may be blocked
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    auth.signInWithRedirect(facebookProvider);
    return;
  }

  auth.signInWithPopup(facebookProvider)
    .then((result) => {
      const user = result.user;
      currentUser = {
        name: user.displayName || 'مستخدم',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.photoURL || '👤',
        uid: user.uid,
        provider: 'facebook'
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
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        showToast('error', 'خطأ', 'الإيميل ده مسجل بطريقة تانية (جوجل أو باسورد) قبل كده');
      } else {
        showToast('error', 'خطأ', getAuthErrorMessage(error.code));
      }
    });
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

