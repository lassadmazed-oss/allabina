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
