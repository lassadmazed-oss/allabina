'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import {
  deleteRequestFileAction,
  signedDocumentUrlAction,
  uploadRequestFileAction,
  type DocumentUploadState,
} from '@/lib/actions/documents'
import { MAX_DOCUMENT_BYTES, humanSize, isPdf, type RequestFile } from '@/lib/documents'

const ERRORS: Record<NonNullable<DocumentUploadState['error']>, string> = {
  type: 'النوع غير مقبول — PDF أو JPG أو PNG أو WebP فقط.',
  size: `الملفّ أكبر من ${MAX_DOCUMENT_BYTES / 1024 / 1024} ميغا.`,
  empty: 'اختار ملفّاً أوّلاً.',
  doc_type: 'اختار نوع الوثيقة.',
  request: 'المطلب ما عادش موجود. حدّث الصفحة.',
  server: 'صار مشكل تقني في الرفع. عاود المحاولة.',
  forbidden: 'ما عندكش صلاحية الرفع.',
}

const initial: DocumentUploadState = { ok: false }
const inputCls =
  'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

/** رفع وثائق المطلب وفتحها برابط موقّع — للفريق فقط */
export default function RequestFiles({
  requestId,
  docTypes,
  files,
}: {
  requestId: string
  docTypes: readonly string[]
  files: RequestFile[]
}) {
  const [state, action, pending] = useActionState(uploadRequestFileAction, initial)
  const formRef = useRef<HTMLFormElement>(null)
  if (state.ok && formRef.current) formRef.current.reset()

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold">الملفّات المرفوعة</h3>
      <p className="mt-1 text-xs leading-6 text-muted">
        مخزن خاصّ: لا رابط عمومي. الفتح برابط موقّع يموت بعد عشر دقائق، ويُسجَّل في سجلّ الأثر.
        PDF · JPG · PNG · WebP حتى 15 ميغا.
      </p>

      <form ref={formRef} action={action} className="mt-4 grid gap-3 sm:grid-cols-6">
        <input type="hidden" name="request_id" value={requestId} />
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs text-muted">الملفّ</span>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className={`${inputCls} file:me-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-xs file:text-brand`}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs text-muted">نوع الوثيقة</span>
          <select name="doc_type" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              —
            </option>
            {docTypes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs text-muted">ملاحظة</span>
          <input name="note" className={inputCls} placeholder="مثال: الصفحة 2 من 3" />
        </label>
        <div className="flex items-center gap-3 sm:col-span-6">
          <button
            disabled={pending}
            className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? 'جاري الرفع…' : 'ارفع الوثيقة'}
          </button>
          {state.ok && !pending && (
            <span role="status" className="text-xs text-brand">
              ✓ رُفعت
            </span>
          )}
          {state.error && !pending && (
            <span role="alert" className="text-xs text-[#8c2f22]">
              {ERRORS[state.error]}
            </span>
          )}
        </div>
      </form>

      {files.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FileRow({ file }: { file: RequestFile }) {
  const [opening, start] = useTransition()
  const [failed, setFailed] = useState(false)

  const open = () =>
    start(async () => {
      const url = await signedDocumentUrlAction(file.id)
      if (!url) {
        setFailed(true)
        return
      }
      // الرابط يُفتح فوراً ولا يُعرض: نصّه ليس للنسخ ولا للإرسال
      window.open(url, '_blank', 'noopener')
    })

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-line px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            isPdf(file.mime) ? 'bg-gold-soft text-gold' : 'bg-brand-soft text-brand'
          }`}
        >
          {isPdf(file.mime) ? 'PDF' : 'صورة'}
        </span>
        <div className="min-w-0">
          <div className="truncate" title={file.original_name}>
            {file.original_name}
          </div>
          <div className="num text-xs text-faint">
            {file.doc_type} · {humanSize(file.bytes)} · {file.created_at.slice(0, 10)}
            {file.note && <span className="text-muted"> · {file.note}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={open}
          disabled={opening}
          className="rounded border border-line px-2.5 py-1 text-xs hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {opening ? '…' : 'افتح'}
        </button>
        <form action={deleteRequestFileAction}>
          <input type="hidden" name="file_id" value={file.id} />
          <button className="rounded border border-line px-2.5 py-1 text-xs text-[#8c2f22] hover:border-[#8c2f22]">
            احذف
          </button>
        </form>
        {failed && <span className="text-xs text-[#8c2f22]">تعذّر الفتح</span>}
      </div>
    </li>
  )
}
