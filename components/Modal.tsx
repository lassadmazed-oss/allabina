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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-surface p-6 shadow-xl ${
          tone === 'error' ? 'border-[#e0b4ac]' : 'border-line'
        }`}
      >
        <h2 className={`display text-lg font-semibold ${tone === 'error' ? 'text-[#8c2f22]' : ''}`}>
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
