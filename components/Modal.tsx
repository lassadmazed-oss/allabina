'use client'

import { useEffect } from 'react'

/**
 * نافذة بسيطة مشتركة بين الاستمارات: تُغلق بـEsc وبالنقر خارجها،
 * وتمنع تمرير الصفحة خلفها. tone="error" للأخطاء.
 */
export default function Modal({
  title,
  onClose,
  tone = 'default',
  children,
}: {
  title: string
  onClose: () => void
  tone?: 'default' | 'error'
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      {/* على التليفون ورقة تطلع من الأسفل: قريبة من الإبهام، وتحترم شريط الجهاز */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        className={`max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-surface p-4 shadow-xl sm:max-h-[85vh] sm:rounded-lg sm:p-6 ${
          tone === 'error' ? 'border-[#e0b4ac]' : 'border-line'
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <h2 className={`display text-lg font-semibold ${tone === 'error' ? 'text-[#8c2f22]' : ''}`}>
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
