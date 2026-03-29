const CACHE_NAME = 'school-platform-v1';
const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700;800&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js',
];

// تثبيت — حفظ الملفات
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['./', './index.html']);
    })
  );
  self.skipWaiting();
});

// تفعيل — حذف الكاش القديم
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// طلبات الشبكة
self.addEventListener('fetch', e => {
  // Firebase requests — دائماً من الشبكة
  if(e.request.url.includes('firestore.googleapis.com') ||
     e.request.url.includes('firebase') ||
     e.request.url.includes('google.com/gsi') ||
     e.request.url.includes('accounts.google.com')){
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }

  // باقي الملفات — من الكاش أولاً
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(res && res.status === 200 && res.type !== 'opaque'){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
