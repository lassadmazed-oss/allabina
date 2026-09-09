'use client'

import { usePathname, useRouter } from 'next/navigation'

/**
 * زرّ رجوع في ترويسة التليفون.
 *
 * على الحاسوب زرّ المتصفّح في متناول اليد؛ على التليفون سهم النظام يختفي
 * أو يخرج من الموقع كلّه. يظهر خارج الرئيسية فقط: يرجع خطوة إن كان ثمّة
 * تاريخ، وإلّا إلى الرئيسية (من فتح رابطاً داخلياً مباشرة).
 */
export default function BackButton({ home, label }: { home: string; label: string }) {
  const pathname = usePathname()
  const router = useRouter()
  if (!pathname || pathname === home || pathname === `${home}/`) return null

  const back = () => {
    if (window.history.length > 1) router.back()
    else router.push(home)
  }

  return (
    <button
      type="button"
      onClick={back}
      aria-label={label}
      title={label}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong/60 bg-surface/70 text-brand transition active:scale-95 lg:hidden"
    >
      {/* السهم في اتجاه الرجوع: يسار في LTR ويُقلب في RTL */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="rtl:-scale-x-100"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )
}
