'use client'

import { useEffect } from 'react'

/**
 * صفحة تُفتح بعد إرسال استمارة طويلة: المتصفّح قد يبقى حيث كان زرّ
 * الإرسال، في أسفل الصفحة، فيرى الحريف ذيل صفحة الشكر لا رأسها.
 */
export default function ScrollTop() {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  return null
}
