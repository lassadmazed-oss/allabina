'use client'

import { useActionState } from 'react'
import { testFormulaAction } from '@/lib/actions/devis'
import { FORMULA_VARS } from '@/lib/devis'

const initial: { result?: string; error?: string } = {}

/** تجربة صيغة الكمّية قبل حفظها — على مشروع نموذجي */
export default function FormulaTester() {
  const [state, action, pending] = useActionState(testFormulaAction, initial)

  return (
    <div className="mt-6 rounded border border-line bg-ground p-4">
      <h3 className="text-xs font-semibold">جرّب صيغة كمّية</h3>
      <p className="mt-1 text-xs leading-6 text-muted">
        المتغيّرات المتاحة:{' '}
        <span className="num" dir="ltr">
          {FORMULA_VARS.join(' · ')}
        </span>
        . العمليات: <span dir="ltr">+ − × ÷</span> والأقواس. مثال:{' '}
        <code className="text-xs">surface * levels * 1.15</code>
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="formula"
          dir="ltr"
          placeholder="surface * 1.15"
          className="num min-w-[220px] flex-1 rounded border border-line bg-surface px-3 py-2 text-left text-sm"
        />
        <button
          disabled={pending}
          className="rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {pending ? '…' : 'جرّب'}
        </button>
      </form>
      {state.result && <p className="mt-2 text-sm text-brand">{state.result}</p>}
      {state.error && <p className="mt-2 text-sm text-[#8c2f22]">{state.error}</p>}
    </div>
  )
}
