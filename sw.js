// ============================================================
// 📦 SERVICE WORKER - بوابة المدرسة الذكية
// ============================================================

const CACHE_NAME = 'school-platform-v2';  // ✅ حدّث الإصدار

// ============================================================
// 📁 الملفات الأساسية للتخزين (Local فقط!)
// ============================================================
const CORE_ASSETS = [
  './',
  './index.html',
  './sw.js'
];

// الروابط الخارجية (بنحاول نخزنها بشكل منفصل)
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700;800&display=swap',
  'https://fonts.gstatic.com/s/ibmplexsansarabic/...'
];

// ============================================================
// 📥 حدث التثبيت (INSTALL)
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] جاري التثبيت...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] فتح الكاش: ', CACHE_NAME);
        
        // ✅ خزن الملفات المحلية أولاً
        return cache.addAll(CORE_ASSETS)
          .then(() => {
            console.log('[SW] ✅ تم تخزين الملفات الأساسية');
            
            // ✅ حاول تخزين الروابط الخارجية (بمعالجة الأخطاء)
            return Promise.allSettled(
              EXTERNAL_ASSETS.map(url =>
                cache.add(url).catch(err => {
                  console.warn('[SW] ⚠️ ما قدرنا نخزن:', url, err.message);
                })
              )
            );
          })
          .then(() => {
            console.log('[SW] ✅ التثبيت اكتمل!');
          });
      })
      .catch(err => {
        console.error('[SW] ❌ خطأ في التثبيت:', err);
      })
  );
  
  // ✅ فعّل فوراً بدون انتظار
  self.skipWaiting();
});

// ============================================================
// 🔄 حدث التفعيل (ACTIVATE)
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] جاري التفعيل...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)  // ✅ احذف القديم
            .map(name => {
              console.log('[SW] 🗑️ حذف كاش قديم:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] ✅ تم التفعيل بنجاح');
        // ✅ سيطر على جميع الصفحات فوراً
        return self.clients.claim();
      })
  );
});

// ============================================================
// 🌐 حدث الطلبات (FETCH) - استراتيجيات ذكية
// ============================================================
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // ============================================================
  // 1️⃣ طلبات Firebase/Firestore → Network First
  // ============================================================
  if (isFirebaseRequest(url)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // ============================================================
  // 2️⃣ طلبات Google Fonts → Stale While Revalidate
  // ============================================================
  if (isFontRequest(url)) {
    event.respondWith(handleFontRequest(request));
    return;
  }
  
  // ============================================================
  // 3️⃣ طلبات الصور والملفات الثابتة → Cache First
  // ============================================================
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // ============================================================
  // 4️⃣ باقي الطلبات (Navigation) → Cache First, Network Fallback
  // ============================================================
  event.respondWith(handleNavigationRequest(request));
});

// ============================================================
// 🎯 دوال مساعدة للاستراتيجيات
// ============================================================

/**
 * تحقق إذا كان الطلب لـ Firebase
 */
function isFirebaseRequest(url) {
  return url.hostname.includes('firestore.googleapis.com') ||
         url.hostname.includes('firebase') ||
         url.hostname.includes('googleapis.com') ||
         url.hostname.includes('google.com') &&
         url.pathname.includes('/gsi/') ||
         url.hostname.includes('accounts.google.com') ||
         url.pathname.includes('/v1:signIn') ||
         url.pathname.includes('/v1:token';
}

/**
 * تحقق إذا كان طلب خط (Font)
 */
function isFontRequest(url) {
  return url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

/**
 * تحقق إذا كان ملف ثابت (صورة، CSS, JS)
 */
function isStaticAsset(request) {
  const header = request.headers.get('Accept') || '';
  return header.includes('image/') ||
         request.url.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i) ||
         request.url.match(/\.(css|js)$/i);
}

/**
 * استراتيجية: Network First مع Cache Fallback
 * للأمثل لـ API / Firebase
 */
async function handleAPIRequest(request) {
  try {
    // ✅ جرب الشبكة أولاً
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // ✅ نسخة في الكاش للاستخدام Offline
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // ❌ الشبكة فاشلة → جرب الكاش
    console.log('[SW] ⚠️ الشبكة غير متاحة، جاري استخدام الكاش');
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // ❌ لا يوجد كاش → رد فارغ للـ API
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'لا يوجد اتصال بالإنترنت'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * استراتيجية: Stale While Revalidate
 * للخطوط - سريع + محدّث
 */
async function handleFontRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // ✅ ارجع الكاش فوراً (لو موجود)
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());  // حدّث الكاش
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);  // لو الشبكة فشلت، رجع للكاش القديم
  
  return cachedResponse || fetchPromise;
}

/**
 * استراتيجية: Cache First
 * للملفات الثابتة (صور، CSS)
 */
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // ✅ موجود في الكاش → ارجعه
    return cachedResponse;
  }
  
  try {
    // ❌ ليس في الكاش → جيب من الشبكة وخزنه
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // ❌ لا شبكة ولا كاش
    return new Response('', { status: 404 });
  }
}

/**
 * استراتيجية: Cache First مع Network Fallback
 * لصفحات HTML (SPA Navigation)
 */
async function handleNavigationRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // ✅ موجود في الكاش
    
    // 🔄 حدّث الكاش في الخلفية (Stale-While-Revalidate)
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {});  // تجاهل أخطاء التحديث
    
    return cachedResponse;
  }
  
  try {
    // ❌ ليس في الكاش → جيب من الشبكة
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // ❌ لا شبكة ولا كاش → صفحة Offline
    return caches.match('./index.html') || new Response(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>غير متصل - بوابة المدرسة</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { 
            font-family:'Segoe UI',Arial,sans-serif; 
            background:#0f0f0f; 
            color:#fff; 
            min-height:100vh; 
            display:flex; 
            align-items:center; 
            justify-content:center; 
            direction:rtl;
          }
          .container { 
            text-align:center; 
            padding:40px; 
            max-width:400px;
          }
          .icon { font-size:80px; margin-bottom:20px; }
          h1 { font-size:24px; margin-bottom:12px; color:#e8854a; }
          p { font-size:14px; opacity:0.6; line-height:1.7; margin-bottom:24px; }
          button { 
            padding:14px 28px; 
            border:none; 
            border-radius:8px; 
            background:linear-gradient(135deg,#e8854a,#f5a623); 
            color:#000; 
            font-weight:700; 
            font-size:15px; 
            cursor:pointer;
          }
          button:hover { transform:scale(1.05); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>لا يوجد اتصال بالإنترنت</h1>
          <p>يبدو أنك غير متصل بالإنترنت.<br/>تأكد من اتصالك ثم أعد المحاولة.</p>
          <button onclick="window.location.reload()">🔄 إعادة المحاولة</button>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    });
  }
}

// ============================================================
// 🔔 Push Notifications (إشعارات فورية)
// ============================================================
self.addEventListener('push', event => {
  console.log('[SW] 📨 استلام إشعار');
  
  let data = {
    title: 'بوابة المدرسة',
    body: 'لديك إشعار جديد',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'school-notification',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'تجاهل' }
    ]
  };
  
  // ✅ استلم البيانات من الإشعار (لو موجودة)
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [],
    dir: 'rtl',
    lang: 'ar'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================================
// 👆 Notification Click (عند الضغط على الإشعار)
// ============================================================
self.addEventListener('notificationclick', event => {
  console.log('[SW] 👆 ضغط على الإشعار:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;  // ❌ تجاهل
  }
  
  // ✅ افتح التطبيق
  const targetUrl = event.notification?.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // ✅ لو التطبيق مفتوح → حدّثه
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(client => client.navigate(targetUrl));
          }
        }
        // ❌ لو التطبيق مغلق → افتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ============================================================
// 🔄 Background Sync (مزامنة في الخلفية)
// ============================================================
self.addEventListener('sync', event => {
  console.log('[SW] 🔄 Background Sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
  
  if (event.tag === 'send-pending-messages') {
    event.waitUntil(sendPendingMessages());
  }
});

/**
 * مزامنة البيانات المعلقة
 */
async function syncPendingData() {
  try {
    // ✅ هنا تقدر تضيف منطق المزامنة
    // مثال: إرسال الحضور المحفوظ محلياً للسحابة
    console.log('[SW] ✅ جاري مزامنة البيانات...');
    
    // TODO: أضف منطق المزامنة هنا
    
  } catch (error) {
    console.error('[SW] ❌ خطأ في المزامنة:', error);
  }
}

/**
 * إرسال الرسائل المعلقة
 */
async function sendPendingMessages() {
  try {
    console.log('[SW] ✅ جاري إرسال الرسائل المعلقة...');
    
    // TODO: أضف منطق إرسال الرسائل هنا
    
  } catch (error) {
    console.error('[SW] ❌ خطأ في إرسال الرسائل:', error);
  }
}

// ============================================================
// 📊 Message Handling (رسائل من التطبيق)
// ============================================================
self.addEventListener('message', event => {
  console.log('[SW] 💬 رسالة من التطبيق:', event.data);
  
  if (!event.data) return;
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      // ✅ تفعيل فوري للـ SW الجديد
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      // ✅ مسح الكاش
      event.waitUntil(
        caches.delete(CACHE_NAME).then(() => {
          console.log('[SW] 🗑️ تم مسح الكاش');
          event.source?.postMessage({ type: 'CACHE_CLEARED' });
        })
      );
      break;
      
    case 'PRECACHE_URLS':
      // ✅ تخزين روابط مسبقاً
      if (event.data.urls) {
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache =>
            cache.addAll(event.data.urls.filter(url => url))
          )
        );
      }
      break;
      
    default:
      console.log('[SW] ❓ نوع رسالة غير معروف:', event.data.type);
  }
});

// ============================================================
// 🗑️ تنظيف الكاش الزائد (اختياري)
// ============================================================
async function cleanOldCaches() {
  const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB
  
  // يمكن إضافة منطق لتقييد حجم الكاش هنا
}

// ============================================================
// 📈 تسجيل الأحداث (للـ Debugging)
// ============================================================
self.addEventListener('install', () => console.log('[SW] ✅ Installed'));
self.addEventListener('activate', () => console.log('[SW] ✅ Activated'));
self.addEventListener('fetch', () => {});  // silent for performance

console.log('[SW] 🚀 Service Worker Loaded - Version:', CACHE_NAME);
