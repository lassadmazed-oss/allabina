'use client'

import { useActionState } from 'react'
import { uploadSitePhotoAction, type SitePhotoState } from '@/lib/actions/chantiers'
import { ALLOWED_ARTICLE_MIME } from '@/lib/article-media'

const ERRORS: Record<string, string> = {
  type: 'نوع الصورة موش مقبول. JPG ولّا PNG ولّا WEBP.',
  size: 'الصورة كبيرة برشا.',
  empty: 'اختار صورة.',
  report: 'ما لقيناش التقرير.',
  locked: 'التقرير معتمَد — ما عادش تتزاد عليه صور.',
  forbidden: 'ما عندكش الصلاحية.',
  server: 'صار مشكل في الرفع. عاود.',
}

/**
 * صور الورشة.
 *
 * من تصويرنا في ورشتنا، فما تحتاجش مصدراً وإذناً كصور المورّدين.
 * والتقرير المعتمَد مقفول: ما اعتُمد يبقى كما اعتُمد.
 */
export default function SitePhotoUpload({ code, reportId }: { code: string; reportId: string }) {
  const [state, action, pending] = useActionState<SitePhotoState, FormData>(
    uploadSitePhotoAction,
    { ok: false }
  )

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="report_id" value={reportId} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1 basis-48">
          <span className="mb-1 block text-xs text-muted">صور اليوم</span>
          <input
            type="file"
            name="photos"
            accept={ALLOWED_ARTICLE_MIME.join(',')}
            multiple
            required
            className="block w-full text-sm"
          />
        </label>
        <label className="block flex-1 basis-40">
          <span className="mb-1 block text-xs text-muted">تعليق</span>
          <input
            name="caption"
            placeholder="صبّ أعمدة الطابق الأوّل"
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-8 rounded border border-line px-3 text-xs disabled:opacity-60"
        >
          {pending ? 'نرفع…' : 'ارفع'}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-xs font-medium text-[#a32a24]">
          {ERRORS[state.error] ?? ERRORS.server}
        </p>
      )}
      {state.ok && state.uploaded ? (
        <p className="text-xs font-medium text-[#1d6b45]">
          رُفعت <span className="num">{state.uploaded}</span> صورة.
        </p>
      ) : null}
    </form>
  )
}
