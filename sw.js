// ============================================
// sw.js - Service Worker لبوابة المدرسة
// ============================================

const CACHE_NAME = 'school-gate-v2';

// 📥 تثبيت الـ Service Worker
self.addEventListener('install', event => {
  console.log('🔧 SW: جاري التثبيت...');
  self.skipWaiting();
});

// ✅ تفعيل الـ Service Worker
self.addEventListener('activate', event => {
  console.log('✅ SW: تم التفعيل');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 🌐 اعتراض طلبات الشبكة
self.addEventListener('fetch', event => {
  
  // ❌ إذا كان الطلب POST أو PUT -> نسيبه يروح عادي (يحل خطأ 404)
  if (event.request.method !== 'GET') {
    return;
  }

  // 🔄 للطلبات GET -> جرب الكاش أولاً، وإلا اجلب من النت
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // إذا موجود بالكاش → ارجعه
        if (cachedResponse) {
          return cachedResponse;
        }

        // إذا موجود → اجلب من النت وخزن بالكاش
        return fetch(event.request).then(response => {
          // إذا كان الرد صالح → خزنه
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
          }
          return response;
        });
      })
      .catch(() => {
        // 🔴 إذا فشل النت → ارجع صفحة offline بسيطة (اختياري)
        /*
        return caches.match('/index.html');
        */
      })
  );
});

// 📨 استقبال رسائل من الصفحة
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
