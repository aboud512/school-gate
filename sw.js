// ============ Service Worker - بوابة المدارس ============
const CACHE_NAME = 'school-gate-v3';
const OFFLINE_PAGE = './index.html';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ===== تثبيت =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ===== تفعيل — حذف الكاش القديم =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== معالجة الطلبات =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase و Google — دائماً من الشبكة
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('oauth2.googleapis.com') ||
    url.hostname.includes('apis.google.com') ||
    url.pathname.includes('/__/auth/')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Google Fonts — من الكاش أولاً
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Firebase JS SDK — من الكاش أولاً
  if (url.hostname.includes('www.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => caches.match(OFFLINE_PAGE));
      })
    );
    return;
  }

  // باقي الطلبات — Network First ثم Cache
  event.respondWith(
    fetch(event.request).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return res;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        return cached || caches.match(OFFLINE_PAGE);
      });
    })
  );
});

// ===== مزامنة البيانات لما يرجع النت =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-school-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('SW: مزامنة البيانات...');
}
