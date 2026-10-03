/*
 * عامل الخدمة: وجوده هو ما يجعل المتصفّح يعرض «تثبيت التطبيق»، وما
 * يجعل الموقع يفتح بلا شريط متصفّح بعد التثبيت.
 *
 * عمداً لا يخزّن صفحات: الصفحات من الشبكة دائماً. لو خزّنّاها لعاد
 * الحريف يقرأ سعراً قديماً أو استمارة قديمة بعد كلّ نشر. المخزَّن هو
 * الملفّات التي لا تتغيّر أبداً — ملفّات _next/static (اسمها يحمل
 * بصمتها) والأيقونات — فلا تقادم ممكن فيها.
 *
 * لإيقافه يوماً: استبدل محتوى هذا الملفّ بـ
 *   self.addEventListener('install', () => self.skipWaiting())
 *   self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()))
 * فيُلغي نفسه عند أوّل زيارة.
 */
const CACHE = 'allabina-static-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // طلبات المجال وحده، قراءةً، وبلا Range (الفيديو يطلب مقاطع لا تُخزَّن)
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const immutable = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
  if (!immutable) return

  event.respondWith(
    (async () => {
      const hit = await caches.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE)
        cache.put(req, res.clone())
      }
      return res
    })()
  )
})
