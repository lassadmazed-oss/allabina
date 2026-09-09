'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/** ماذا حُفظ بالضبط — أدقّ من «تمّ الحفظ» في شاشة فيها عشر استمارات */
const LABELS: Record<string, string> = {
  status: 'تحيّنت حالة المطلب',
  net_status: 'تحيّنت حالة المتدخّل',
  note: 'تسجّلت الملاحظة',
  config: 'تسجّلت مواصفات المشروع',
  devis: 'تولّد العرض التقديري',
  track: 'تسجّل تصنيف الدراسة',
  social: 'تسجّل المسار الاجتماعي',
  assessment: 'تسجّلت دراسة المساندة',
  solution: 'تسجّل عنصر الحلّ',
  task: 'تسجّلت المهمّة',
  match: 'تسجّل العرض للمتابعة',
  public: 'تحيّن ما يراه الحريف',
  classify: 'تسجّل تصنيف الملفّ',
  followup: 'تسجّلت المتابعة',
  interaction: 'تسجّل الاستفسار',
  document: 'تحيّنت الوثائق',
  upload: 'رُفعت الوثيقة',
  case: 'تسجّلت الحالة',
  ledger: 'تسجّل القيد في الدفتر',
  photo: 'تسجّلت الصورة',
  member: 'تسجّل العضو',
  availability: 'تحيّن التوفّر',
  sms: 'انبعثت الرسالة',
  price: 'تحيّن السعر',
  system: 'تسجّلت طريقة البناء',
  limits: 'تحيّنت حدود النظام',
  maker: 'تسجّل المصنّع',
  offering: 'تسجّل العرض',
  component: 'تسجّل العنصر',
  component_removed: 'تشطب العنصر',
  span: 'تسجّل حدّ البحر',
  rule: 'تسجّلت قاعدة الكمّية',
  assembly: 'تسجّلت تركيبة السقف',
}

export default function SaveToast() {
  const params = useSearchParams()
  const pathname = usePathname()
  const key = params.get('saved')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!key) return
    setVisible(true)

    // Next يعيد مزامنة العنوان بعد إعادة توجيه Server Action، فينسخ أيّ
    // تنظيف فوري. ننتظر أن يستقرّ ثمّ نمسح `saved` بلا إعادة تنقّل.
    const clean = setTimeout(() => {
      const url = new URL(window.location.href)
      if (!url.searchParams.has('saved')) return
      url.searchParams.delete('saved')
      window.history.replaceState(null, '', url.pathname + url.search)
    }, 500)

    const timer = setTimeout(() => setVisible(false), 3200)
    return () => {
      clearTimeout(timer)
      clearTimeout(clean)
    }
  }, [key, pathname])

  if (!visible || !key) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-brand/30 bg-brand px-4 py-2.5 text-sm text-white shadow-lg">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 0a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.1-5.6 5.6a1 1 0 0 1-1.4 0L5.3 10.3a1 1 0 1 1 1.4-1.4l1.7 1.7 4.9-4.9a1 1 0 1 1 1.4 1.4Z"
          />
        </svg>
        {LABELS[key] ?? 'تمّ الحفظ'}
      </div>
    </div>
  )
}
