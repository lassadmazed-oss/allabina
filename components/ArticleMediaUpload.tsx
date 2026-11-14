'use client'

import { useActionState } from 'react'
import { uploadArticleMediaAction, type MediaState } from '@/lib/actions/article-media'
import { ALLOWED_ARTICLE_MIME, MAX_ARTICLE_PHOTOS } from '@/lib/article-media'

const ERRORS: Record<string, string> = {
  type: 'نوع الصورة موش مقبول. JPG ولّا PNG ولّا WEBP.',
  size: 'الصورة كبيرة برشا. الحدّ 5 ميغا.',
  empty: 'اختار صورة.',
  rights: 'المصدر والترخيص واجبين. صورة بلا إذن ما تتنشرش.',
  too_many: `ما تنجّمش ترفع أكثر من ${MAX_ARTICLE_PHOTOS} صور مرّة.`,
  article: 'ما لقيناش هالمقال.',
  forbidden: 'ما عندكش الصلاحية.',
  server: 'صار مشكل في الرفع. عاود.',
}

/**
 * رفع صور المقال.
 *
 * المصدر والترخيص خانتان مطلوبتان في نفس النموذج لا بعده: من يرفع يعرف
 * من أين جاءت الصورة، ومن يراجع بعد أسبوع لا يعرف. والخادم يرفض الرفع
 * بدونهما — الخانة `required` تذكير لا حارس.
 */
export default function ArticleMediaUpload({ code }: { code: string }) {
  const [state, action, pending] = useActionState<MediaState, FormData>(
    uploadArticleMediaAction,
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
            placeholder="مثال: تصوير فريق اللَّبنة · ورشة صفاقس"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">الترخيص</span>
          <input
            name="license"
            required
            placeholder="مثال: ملك اللَّبنة · إذن المزوّد"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">وصف الصورة (لقارئ الشاشة)</span>
        <input
          name="alt_ar"
          placeholder="شنوّة تبيّن الصورة؟"
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
        صورة بلا مصدر وترخيص ما تظهرش في الكاتالوج العمومي — الشرط محروس عند القراءة لا عند
        الرفع فقط.
      </p>
    </form>
  )
}
