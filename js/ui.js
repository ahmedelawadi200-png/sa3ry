// ==================== UI.JS ====================
// Global state, app bootstrap, onboarding, navigation, dark mode, modals,
// toasts, PWA install prompt, loading states/skeletons, accessibility,
// pull-to-refresh, image fallback, and keyboard shortcuts.
// Depends on: utils.js, firebase.js, products.js (renderProducts etc.).
'use strict';

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
  // BUGFIX: this used to just pop a one-line toast instead of a real About
  // page - now it opens the actual "من نحن" page.
  window.open('pages/about.html', '_blank');
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

// ==================== PWA INSTALL ====================
let deferredPrompt = null;
const INSTALL_DISMISS_KEY = 'sa3ry_install_dismissed_at';
const INSTALL_DISMISS_COOLDOWN_DAYS = 7;

function installBannerDismissedRecently() {
  const ts = localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!ts) return false;
  const daysSince = (Date.now() - parseInt(ts)) / (1000 * 60 * 60 * 24);
  return daysSince < INSTALL_DISMISS_COOLDOWN_DAYS;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // BUGFIX: the banner used to reappear on every visit even after the user
  // dismissed it. Now it respects a 7-day cooldown after a dismissal.
  if (!installBannerDismissedRecently()) {
    setTimeout(() => showInstallBanner(), 3000);
  }
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
      localStorage.removeItem(INSTALL_DISMISS_KEY);
    }
    deferredPrompt = null;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
  });
}

function dismissInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
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
  // BUGFIX: this ran while the modal was still mid slide-up-animation
  // (called after only 50ms, well before the 300-350ms CSS transition
  // finishes). Focusing an element mid-animation made the browser try to
  // scroll it into view based on its not-yet-settled position, which
  // fought with the modal's own scroll container and caused it to jump
  // and land scrolled-down instead of at the top. `preventScroll: true`
  // stops the browser from doing any scrolling as a side effect of focus -
  // the modal already opens scrolled to the top on its own.
  first.focus({ preventScroll: true });
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
      if (document.activeElement === first) { e.preventDefault(); last && last.focus({ preventScroll: true }); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first && first.focus({ preventScroll: true }); }
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

