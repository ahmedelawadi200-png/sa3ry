// ==================== SEARCH.JS ====================
// Text search, voice search, camera/image search, QR scanner, and
// smart search suggestions.
// Depends on: products.js (productsData, renderProducts).
'use strict';

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
    `<img src="${url}" alt="صورة ملتقطة" data-onclick="viewPhoto('${url}')">`
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
  const btn = document.getElementById('qrToggleBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...'; }

  const ready = typeof Html5Qrcode !== 'undefined'
    ? Promise.resolve()
    : loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js');

  ready.then(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-stop"></i> إيقاف الماسح'; }
    html5QrCode = new Html5Qrcode("qrScannerContainer");
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 200 } },
      onQRScanSuccess,
      onQRScanFailure
    ).catch(err => {
      showToast('error', 'خطأ', 'لا يمكن تشغيل الكاميرا');
    });
  }).catch(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> تشغيل الكاميرا'; }
    showToast('error', 'خطأ', 'تعذر تحميل ماسح QR، تحقق من الإنترنت');
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
  // BUGFIX: search input used to be "sanitized" by a patch in utils.js that
  // never actually worked - utils.js loads before this file, so by the time
  // this real performSearch() was defined here, it silently overwrote that
  // patched version entirely. Applying the same strip-tags + length-cap
  // directly here instead, as originally intended.
  input.value = input.value.replace(/<[^>]*>/g, '').slice(0, 100);
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

    try {
      const data = await uploadToCloudinary(new File([blob], 'search.jpg', { type: 'image/jpeg' }));
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

// ==================== SMART SEARCH SUGGESTIONS ====================
const _origHandleSearchInput = window.handleSearchInput;
window.handleSearchInput = function() {
  const input = document.getElementById('searchInput');
  const val = input ? input.value.trim().toLowerCase() : '';

  if (val.length > 1) {
    // BUGFIX: suggestions used to only match product name/brand; now uses
    // the same matching logic as the main search (name, brand, category, price).
    const terms = val.split(/\s+/).filter(Boolean);
    const matches = productsData.filter(p => {
      const minPrice = getMinPrice(p);
      const haystack = [p.name, p.brand, getCategoryLabel(p.category), minPrice !== null ? String(minPrice) : '']
        .join(' ').toLowerCase();
      return terms.every(t => haystack.includes(t));
    }).slice(0, 4);

    const dynSugg = document.getElementById('dynamicSuggestions');
    if (dynSugg && matches.length > 0) {
      dynSugg.innerHTML = matches.map(p => {
        const minP = getMinPrice(p);
        return `<div class="suggestion-item" data-onclick="quickSearch('${p.name.replace(/'/g,"\'")}')">
          <span style="font-size:18px;margin-left:8px">${p.icon}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700">${p.name}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">${minP !== null ? 'من ' + minP.toLocaleString() + ' ج.م' : ''}</div>
          </div>
        </div>`;
      }).join('');
    } else if (dynSugg) {
      dynSugg.innerHTML = '';
    }
  } else {
    const dynSugg = document.getElementById('dynamicSuggestions');
    if (dynSugg) dynSugg.innerHTML = '';
  }

  if (_origHandleSearchInput) _origHandleSearchInput();
};

