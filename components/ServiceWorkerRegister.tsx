'use client'

import { useEffect } from 'react'

/**
 * يسجّل public/sw.js. بلا تسجيل لا يعرض المتصفّح «تثبيت التطبيق».
 * يُؤجَّل إلى ما بعد التحميل حتّى لا يزاحم تحميل الصفحة نفسها، ويُترك
 * صامتاً عند الفشل: التثبيت ميزة زائدة لا شرط لعمل الموقع.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    /* لا عامل خدمة في التطوير: ملفّات next dev تحت /_next/static ليست
       مبصومة بمحتواها كما في البناء، فتخزينها يخلط نسخ الحزم ويعطّل
       الصفحة. وإن سبق تسجيله على localhost يُلغى ويُمسح مخزونه. */
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()))
      if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      return
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
