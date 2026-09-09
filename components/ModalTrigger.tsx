'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

/**
 * زرّ يفتح نافذة تحمل محتواها.
 *
 * لماذا: شاشات الإدارة كانت تكدّس كلّ استمارة مفتوحة في الصفحة، فتصير
 * جداراً يُمرَّر ولا يُقرأ. الاستمارة التي تُستعمل مرّة في اليوم لا تستحقّ
 * أن تحتلّ الشاشة طوال اليوم — تُطوى خلف زرّ، وتُفتح حين تُطلب.
 *
 * المحتوى يبقى Server Component يُمرَّر كـchildren: لا يتحوّل شيء إلى
 * عميل لمجرّد أنّه داخل نافذة.
 */
export default function ModalTrigger({
  label,
  title,
  variant = 'primary',
  /** الرمز قبل النصّ — null لأزرار التعديل: «+ تعديل» تناقض */
  icon = '+',
  children,
}: {
  label: string
  title: string
  variant?: 'primary' | 'ghost'
  icon?: string | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const cls =
    variant === 'primary'
      ? 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-deep active:scale-[0.99]'
      : 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm text-muted transition hover:border-brand hover:text-brand active:scale-[0.99]'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        {icon && (
          <span aria-hidden="true" className="text-base leading-none">
            {icon}
          </span>
        )}
        {label}
      </button>

      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          {/* الإرسال يعيد تحميل الصفحة من الخادم، فتُغلق النافذة معه */}
          <div onClick={(e) => e.stopPropagation()}>{children}</div>
        </Modal>
      )}
    </>
  )
}
