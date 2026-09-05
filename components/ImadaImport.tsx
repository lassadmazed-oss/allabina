'use client'

import { useActionState } from 'react'
import { importImadasAction } from '@/lib/actions/admin'

const initial: { message?: string; error?: string } = {}

export default function ImadaImport() {
  const [state, action, pending] = useActionState(importImadasAction, initial)

  return (
    <div className="rounded border border-line bg-surface p-6">
      <h3 className="font-semibold">إضافة العمادات</h3>
      <p className="mt-2 text-sm leading-7 text-muted">
        سطر لكلّ معتمدية بالشكل: <code className="text-xs">المعتمدية: عمادة، عمادة، عمادة</code>.
        الأسماء تتلصّق كما هي من قائمة وزارة الداخلية، والتسجيل يتجاهل المكرّر.
      </p>

      <form action={action} className="mt-4">
        <textarea
          name="data"
          rows={6}
          dir="rtl"
          placeholder={'قرقنة: عمادة…، عمادة…\nالمحرس: عمادة…، عمادة…'}
          className="w-full rounded border border-line bg-surface p-3 text-sm outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? 'جاري التسجيل…' : 'سجّل العمادات'}
          </button>
          {state.message && <span className="text-sm text-brand">{state.message}</span>}
          {state.error && <span className="text-sm text-[#8c2f22]">{state.error}</span>}
        </div>
      </form>
    </div>
  )
}
