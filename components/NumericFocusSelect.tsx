'use client'

import { useEffect } from 'react'

/**
 * حقل رقمي فيه قيمة (0 مثلاً) يُنتقى نصّه كلّه عند التركيز، فالكتابة
 * تستبدله بدل أن تُلحق به: «0» ثمّ كتابة 200 كانت تعطي «0200».
 * مستمع واحد على المستند يغطّي الموقع كلّه، بلا لمس كلّ حقل على حدة.
 */
export default function NumericFocusSelect() {
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement)) return
      const numeric = el.type === 'number' || el.inputMode === 'numeric' || el.inputMode === 'decimal'
      if (!numeric || el.value === '') return
      // بعد أن يضع المتصفّح المؤشّر حيث نُقر
      window.setTimeout(() => {
        try {
          el.select()
        } catch {}
      }, 0)
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  return null
}
