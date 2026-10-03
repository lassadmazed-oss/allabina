'use client'

import { useEffect, useState } from 'react'

/**
 * زرّ «ثبّت التطبيق».
 *
 * كروم على أندرويد يطلق beforeinstallprompt متى صار الموقع قابلاً
 * للتثبيت، ويمنع فتح النافذة إلّا من نقرة المستخدم. الحدث يُلتقط في
 * نصّ صغير في الترويسة (app/(site)/[locale]/layout.tsx) ويُحفظ في
 * window.__bip، لأنّه قد يسبق تحميل هذا المكوّن.
 *
 * الزرّ لا يُرسم إلّا إن كان التثبيت ممكناً فعلاً: فسفاري على الآيفون
 * لا يطلق الحدث أصلاً (التثبيت هناك من «إضافة إلى الشاشة الرئيسية»)،
 * ومن ثبّت التطبيق لا يراه ثانية.
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __bip?: InstallEvent | null
  }
}

export default function InstallApp({
  label,
  hint,
  tone = 'light',
}: {
  label: string
  /** سطر صغير تحت الاسم — لماذا يثبّته أصلاً */
  hint?: string
  /** على أرضية فاتحة (القائمة) أو داكنة (التذييل) */
  tone?: 'light' | 'dark'
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setReady(Boolean(window.__bip))
    sync()
    window.addEventListener('bip:ready', sync)
    return () => window.removeEventListener('bip:ready', sync)
  }, [])

  if (!ready) return null

  const install = async () => {
    const event = window.__bip
    if (!event) return
    // النافذة لا تُفتح إلّا مرّة واحدة لكلّ حدث: نُسقطه بعدها مهما كان الجواب
    await event.prompt()
    await event.userChoice
    window.__bip = null
    window.dispatchEvent(new Event('bip:ready'))
  }

  const skin =
    tone === 'dark'
      ? 'border-white/30 text-white hover:border-gold-light hover:text-gold-light'
      : 'border-line-strong/70 text-brand hover:border-brand hover:bg-brand-soft/60'

  return (
    <button
      type="button"
      onClick={install}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition active:scale-[0.99] ${skin}`}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M10 3v9m0 0 3.2-3.2M10 12 6.8 8.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="flex flex-col items-center leading-tight">
        {label}
        {hint && <span className="text-[11px] font-normal opacity-75">{hint}</span>}
      </span>
    </button>
  )
}
