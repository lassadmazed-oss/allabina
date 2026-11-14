'use client'

import { useActionState } from 'react'
import { uploadProductMediaAction, type ProductMediaState } from '@/lib/actions/products'
import { ALLOWED_ARTICLE_MIME } from '@/lib/article-media'

const ERRORS: Record<string, string> = {
  type: 'نوع الصورة موش مقبول. JPG ولّا PNG ولّا WEBP.',
  size: 'الصورة كبيرة برشا. الحدّ 5 ميغا.',
  empty: 'اختار صورة.',
  rights: 'المصدر والإذن واجبين. صورة المنتَج ملك صاحبها.',
  product: 'ما لقيناش هالمنتَج.',
  forbidden: 'ما عندكش الصلاحية.',
  server: 'صار مشكل في الرفع. عاود.',
}

/**
 * رفع صور المنتَج.
 *
 * صور المنتجات أغلبها ملك مورّديها، فالمصدر والإذن شرط **الرفع** لا
 * شرط النشر: من يرفع يعرف من أين جاءت الصورة وهل سمحوا بها، ومن
 * يراجع بعد شهر لا يعرف. ورابط الصفحة الأصلية يُحفظ معها حتّى يُرجَع
 * إليه عند أيّ سؤال.
 */
export default function ProductMediaUpload({ code }: { code: string }) {
  const [state, action, pending] = useActionState<ProductMediaState, FormData>(
    uploadProductMediaAction,
    { ok: false }
  )

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="code" value={code} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">الصور</span>
        <input
          type="file"
          name="photos"
          accept={ALLOWED_ARTICLE_MIME.join(',')}
          multiple
          required
          className="block w-full text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">المصدر</span>
          <input
            name="credit"
            required
            placeholder="مثال: أسترال تونس"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">الإذن</span>
          <input
            name="license"
            required
            placeholder="مثال: إذن كتابي من المورّد · 12 نوفمبر 2026"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">رابط الصفحة الأصلية</span>
        <input
          name="source_url"
          type="url"
          dir="ltr"
          placeholder="https://…"
          className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-[#a32a24]">
          {ERRORS[state.error] ?? ERRORS.server}
        </p>
      )}
      {state.ok && state.uploaded ? (
        <p className="text-sm font-medium text-[#1d6b45]">
          رُفعت <span className="num">{state.uploaded}</span> صورة.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'نرفع…' : 'ارفع'}
      </button>

      <p className="text-xs leading-7 text-faint">
        <b>ما تاخذش صورة من موقع بلا إذن.</b> أغلب المورّدين يسمحو إذا سألتهم — وهي نفس
        المكالمة اللي تجيب السعر الحقيقي.
      </p>
    </form>
  )
}
