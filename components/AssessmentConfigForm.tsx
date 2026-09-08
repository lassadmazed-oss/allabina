'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveAssessmentConfigAction, type SettingsState } from '@/lib/actions/settings'
import {
  CRITERIA,
  RUBRIC,
  normalizeWeights,
  type Thresholds,
  type Weights,
} from '@/lib/support-assessment'

const initial: SettingsState = { ok: false }
const cls = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm num'

/**
 * أوزان دراسة المساندة وحدود فئاتها — تُعدَّل من هنا بلا مطوّر.
 * المجموع يُعرض حيّاً؛ إن لم يكن 100 يُسوّى عند الحساب ويُقال ذلك صراحةً.
 */
export default function AssessmentConfigForm({
  weights,
  thresholds,
}: {
  weights: Weights
  thresholds: Thresholds
}) {
  const [state, action, pending] = useActionState(saveAssessmentConfigAction, initial)
  const [w, setW] = useState<Weights>(() => {
    const o = {} as Weights
    for (const c of CRITERIA) o[c] = Math.round(weights[c])
    return o
  })
  const sum = useMemo(() => CRITERIA.reduce((s, c) => s + (Number(w[c]) || 0), 0), [w])
  const normalized = useMemo(() => normalizeWeights(w), [w])

  return (
    <form action={action} className="mt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {CRITERIA.map((c) => (
          <label key={c} className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
              <span>{RUBRIC[c].title}</span>
              {sum !== 100 && sum > 0 && (
                <span className="num text-faint">≈ {Math.round(normalized[c])}</span>
              )}
            </span>
            <input
              name={`w_${c}`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={w[c]}
              onChange={(e) => setW((s) => ({ ...s, [c]: Number(e.target.value) }))}
              className={cls}
            />
          </label>
        ))}
      </div>
      <p className={`mt-2 text-xs ${sum === 100 ? 'text-faint' : 'text-gold'}`}>
        المجموع <b className="num">{sum}</b>
        {sum === 100 ? '' : ' — ليس 100، يُسوّى تلقائياً عند الحساب (القيم التقريبية جنب كلّ معيار)'}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">أولوية من</span>
          <input name="t_priority" type="number" min={0} max={100} defaultValue={thresholds.priority} className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">مؤهّل من</span>
          <input name="t_eligible" type="number" min={0} max={100} defaultValue={thresholds.eligible} className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">للمراجعة من</span>
          <input name="t_review" type="number" min={0} max={100} defaultValue={thresholds.review} className={cls} />
        </label>
      </div>
      <p className="mt-2 text-xs text-faint">
        ما دون «للمراجعة» غير مؤهّل. الحدود متنازلة وجوباً. تغيير الأوزان لا يعيد حساب الدراسات
        المحفوظة — كلّ دراسة تحمل أوزان وقتها.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? 'جاري الحفظ…' : 'احفظ الأوزان والحدود'}
        </button>
        {state.ok && !pending && <span role="status" className="text-xs text-brand">✓ حُفظت</span>}
        {state.error && !pending && <span role="alert" className="text-xs text-[#8c2f22]">{state.error}</span>}
      </div>
    </form>
  )
}
