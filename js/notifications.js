// ==================== NOTIFICATIONS.JS ====================
// In-app notification center, Web Push subscription, and background sync
// for price alerts.
// Depends on: utils.js, firebase.js.
'use strict';

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
    // Real project VAPID key (from Firebase Console → Project settings → Cloud Messaging)
    const vapidKey = 'BJZi6ThR4rsP74sJ2oiCDJhBYvATXJF-lK4vo1dXzyB6EAZMUC0KIffPeNu6UvKji3PsxnqsFVzoatv_gg9tDe8';
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

// NOTE: toggleNotifications() used to be patched here to also call
// subscribeToPushNotifications() - but notifications.js loads before ui.js
// defines the real toggleNotifications(), so the patch was silently
// clobbered and never ran. That logic now lives directly inside
// toggleNotifications() in ui.js instead.

// ==================== BACKGROUND SYNC FOR PRICE ALERTS ====================
async function syncPriceAlerts() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-price-alerts');
    console.log('Background sync registered for price alerts');

    // Periodic Background Sync is a newer, more powerful API (installed PWAs
    // on supporting browsers only) - register it too if available, but this
    // is a nice-to-have, not a requirement, so failures are silent.
    if ('periodicSync' in reg) {
      try {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await reg.periodicSync.register('periodic-price-check', { minInterval: 12 * 60 * 60 * 1000 });
        }
      } catch (e) { /* not supported/granted - fine, one-off sync still works */ }
    }
  } catch(e) {
    console.warn('Background sync failed:', e);
  }
}

// Patch savePriceAlert to also register sync AND persist the alert into
// IndexedDB, since the Service Worker (where Background Sync actually runs)
// cannot read localStorage - only IndexedDB. Without this, "Background Sync"
// had nothing real to sync: it registered a sync event but the alert data
// was unreachable from the SW.
const _origSavePriceAlert = window.savePriceAlert;
window.savePriceAlert = function() {
  const target = document.getElementById('targetPrice')?.value;
  const phone = document.getElementById('alertPhone')?.value;
  if (target && phone && typeof currentProduct !== 'undefined' && currentProduct) {
    idbSave('priceAlerts', {
      productId: currentProduct.id,
      productName: currentProduct.name,
      targetPrice: parseInt(target),
      phone,
      createdAt: Date.now(),
      notified: false
    }).catch(() => {});
  }
  if (_origSavePriceAlert) _origSavePriceAlert();
  syncPriceAlerts();
};

