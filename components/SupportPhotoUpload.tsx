'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { uploadSupportPhotosAction, type SupportPhotoState } from '@/lib/actions/support-photos'
import { MAX_PHOTO_BYTES } from '@/lib/photos'

const ERRORS: Record<NonNullable<SupportPhotoState['error']>, string> = {
  type: 'النوع غير مقبول: JPG أو PNG أو WebP فقط.',
  size: `صورة أكبر من ${MAX_PHOTO_BYTES / 1024 / 1024} ميغا. صغّرها قبل الرفع.`,
  empty: 'اختار صورة واحدة على الأقلّ.',
  case: 'الحالة ما عادتش موجودة. حدّث الصفحة.',
  server: 'صار مشكل تقني في الرفع. عاود المحاولة.',
  forbidden: 'ما عندكش صلاحية الرفع.',
  too_many: 'ستّ صور على الأكثر في الدفعة الواحدة.',
}

/** حدّ جسم الطلب 16 ميغا: نمنع الدفعة الثقيلة قبل ما تمشي للخادم */
const BATCH_LIMIT = 15 * 1024 * 1024

const initial: SupportPhotoState = { ok: false }

/** رفع صور تعرض حالة تحتاج مساندة — حتى ستّ صور في الدفعة، والنموذج يفرّغ نفسه بعد النجاح */
export default function SupportPhotoUpload({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(uploadSupportPhotosAction, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const [picked, setPicked] = useState<{ count: number; bytes: number }>({ count: 0, bytes: 0 })

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      setPicked({ count: 0, bytes: 0 })
    }
  }, [state])

  const tooHeavy = picked.bytes > BATCH_LIMIT
  const tooMany = picked.count > 6

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="support_case_id" value={caseId} />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-ground px-4 py-5 text-center transition hover:border-brand">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-muted" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        <span className="text-sm font-medium text-brand">
          {picked.count ? `${picked.count} صورة مختارة` : 'اختار صوراً تعرض الحالة'}
        </span>
        <span className="text-[11px] text-faint">JPG · PNG · WebP — حتى ستّ صور في الدفعة</span>
        <input
          type="file"
          name="photos"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            setPicked({ count: files.length, bytes: files.reduce((s, f) => s + f.size, 0) })
          }}
        />
      </label>
      <input
        name="caption_ar"
        placeholder="تعليق (اختياري): مثال السقف من الداخل قبل الترميم"
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || !picked.count || tooHeavy || tooMany}
          className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-50"
        >
          {pending ? 'جاري الرفع…' : 'ارفع الصور'}
        </button>
        {state.ok && !pending && (
          <span role="status" className="text-xs text-[#1f6b3f]">
            ✓ رُفعت <span className="num">{state.uploaded}</span> صورة
          </span>
        )}
      </div>
      {(tooHeavy || tooMany) && (
        <p role="alert" className="rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold">
          {tooMany ? ERRORS.too_many : 'الدفعة أثقل من 15 ميغا — ارفعها على دفعتين.'}
        </p>
      )}
      {state.error && !pending && (
        <p role="alert" className="rounded-lg bg-[#fbeeeb] px-3 py-2 text-xs text-[#8c2f22]">
          {ERRORS[state.error]}
        </p>
      )}
      <p className="text-[11px] leading-5 text-faint">
        قاعدة تحريرية: بلا وجوه، بلا أسماء، بلا لوحات أرقام. الحالة مجهّلة الهوية، والصورة ما تفضحش ما يخفيه النصّ.
      </p>
    </form>
  )
}
