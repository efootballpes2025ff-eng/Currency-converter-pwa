/**
 * Smart Converter Service Worker - Version 5.0 (ES7 Async/Await)
 * تم تحسين الكود ليكون أنظف وأكثر كفاءة باستخدام استراتيجيات الجلب الحديثة.
 */

const CACHE_NAME = 'smart-converter-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// --- مرحلة التثبيت (Install Event) ---
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    console.log('[SW] جاري تخزين الأصول الثابتة...');
    await cache.addAll(ASSETS_TO_CACHE);
    await self.skipWaiting();
  })());
});

// --- مرحلة التنشيط (Activate Event) ---
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // مسح إصدارات الكاش القديمة لضمان نظافة التخزين
    await Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    );
    await self.clients.claim();
    console.log('[SW] النظام جاهز للعمل أوفلاين.');
  })());
});

// --- مرحلة الجلب (Fetch Event) ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استراتيجية Network-First لبيانات العملات (API)
  if (url.hostname.includes('exchangerate-api.com')) {
    event.respondWith(handleApiRequest(request));
  } else {
    // استراتيجية Cache-First للأصول الثابتة (Static Assets)
    event.respondWith(handleStaticRequest(request));
  }
});

/**
 * معالجة طلبات الـ API: نحاول جلب البيانات من الشبكة أولاً، وإذا فشلنا نستخدم الكاش.
 */
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // حفظ نسخة من أحدث الأسعار في الكاش للعمل أوفلاين لاحقاً
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.log('[SW] فشل جلب العملات من الشبكة، جاري المحاولة من الكاش...');
    return await cache.match(request);
  }
}

/**
 * معالجة الأصول الثابتة: نستخدم الكاش فوراً لتسريع التشغيل، ونعود للشبكة إذا لم نجد الملف.
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    // تخزين أي أصل جديد يتم طلبه ولم يكن في القائمة الأساسية
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // إذا انقطع الإنترنت تماماً، نقوم بإرجاع صفحة البداية
    if (request.mode === 'navigate') {
      return await cache.match('./index.html');
    }
  }
}
