'use client'

import { useActionState, useRef } from 'react'
import { uploadCasePhotoAction, type PhotoUploadState } from '@/lib/actions/photos'
import { MAX_PHOTO_BYTES, PHOTO_STAGES } from '@/lib/photos'

const STAGE_AR: Record<string, string> = { before: 'قبل', progress: 'أثناء الأشغال', after: 'بعد' }

const ERRORS: Record<NonNullable<PhotoUploadState['error']>, string> = {
  type: 'النوع غير مقبول — JPG أو PNG أو WebP فقط.',
  size: `الصورة أكبر من ${MAX_PHOTO_BYTES / 1024 / 1024} ميغا. صغّرها قبل الرفع.`,
  empty: 'اختار صورة أوّلاً.',
  stage: 'اختار المرحلة: قبل، أثناء، أو بعد.',
  case: 'الحالة ما عادتش موجودة. حدّث الصفحة.',
  server: 'صار مشكل تقني في الرفع. عاود المحاولة.',
  forbidden: 'ما عندكش صلاحية الرفع.',
}

const initial: PhotoUploadState = { ok: false }

/** نموذج رفع صورة لحالة منجزة — يفرّغ نفسه بعد كلّ رفع ناجح */
export default function CasePhotoUpload({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(uploadCasePhotoAction, initial)
  const formRef = useRef<HTMLFormElement>(null)

  if (state.ok && formRef.current) formRef.current.reset()

  const cls = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="case_id" value={caseId} />

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs text-muted">الصورة</span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className={`${cls} file:me-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-xs file:text-brand`}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted">المرحلة</span>
        <select name="stage" defaultValue="progress" className={cls}>
          {PHOTO_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_AR[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted">تاريخ اللقطة</span>
        <input type="date" name="taken_at" className={`${cls} num`} />
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs text-muted">تعليق (عربي)</span>
        <input name="caption_ar" className={cls} placeholder="مثال: صبّ سقف الطابق الأرضي" />
      </label>

      <label className="block sm:col-span-3">
        <span className="mb-1.5 block text-xs text-muted">تعليق (فرنسي)</span>
        <input name="caption_fr" className={cls} />
      </label>

      <div className="flex items-end gap-3 sm:col-span-3">
        <button
          disabled={pending}
          className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? 'جاري الرفع…' : 'ارفع الصورة'}
        </button>
        {state.ok && !pending && (
          <span role="status" className="text-xs text-brand">
            ✓ رُفعت
          </span>
        )}
      </div>

      {state.error && !pending && (
        <p role="alert" className="rounded border border-[#e0b4ac] bg-[#fbeeeb] px-3 py-2 text-xs text-[#8c2f22] sm:col-span-6">
          {ERRORS[state.error]}
        </p>
      )}

      <p className="text-xs leading-6 text-faint sm:col-span-6">
        <b>قاعدة تحريرية:</b> بلا وجوه، بلا أسماء على اللوحات، بلا لوحات أرقام سيارات. الحالة
        مجهّلة الهوية والصورة تفضح ما يخفيه النصّ. JPG · PNG · WebP حتى 8 ميغا.
      </p>
    </form>
  )
}
