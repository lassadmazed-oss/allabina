'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveSupportAssessmentAction, type AssessmentState } from '@/lib/actions/assessment'
import {
  BAND_AR,
  CRITERIA,
  DECISIONS,
  DECISION_AR,
  REASON_REQUIRED,
  RUBRIC,
  assess,
  type Decision,
  type Scores,
  type Thresholds,
  type Verification,
  type Weights,
} from '@/lib/support-assessment'

const initial: AssessmentState = { ok: false }

const CHECKS: [keyof Verification, string][] = [
  ['phone_verified', 'مكالمة مع صاحب الطلب'],
  ['documents_checked', 'وثائق مُراجَعة'],
  ['third_party_confirmed', 'شهادة طرف ثالث (عمدة · جمعية · شريك)'],
  ['home_visit_done', 'زيارة ميدانية'],
]

const BAND_CLS: Record<string, string> = {
  priority: 'bg-brand text-white',
  eligible: 'bg-brand-soft text-brand',
  review: 'bg-gold-soft text-gold',
  not_eligible: 'bg-surface-2 text-muted',
}

/**
 * دراسة طلب المساندة. الدرجة تتحرّك وأنت تقيّم — لكن ما يُحفظ هو حساب
 * الخادم بنفس المحرّك، فلا فرق. القرار يبقى للإنسان وبسبب مكتوب.
 */
export default function SupportAssessmentForm({
  requestId,
  existing,
  weights,
  thresholds,
}: {
  requestId: string
  existing: (Scores & Verification & { decision: Decision; decision_reason: string | null; verification_note: string | null }) | null
  weights: Weights
  thresholds: Thresholds
}) {
  const [state, action, pending] = useActionState(saveSupportAssessmentAction, initial)

  const [scores, setScores] = useState<Scores>({
    vulnerability: existing?.vulnerability ?? 0,
    urgency: existing?.urgency ?? 0,
    housing_gap: existing?.housing_gap ?? 0,
    self_effort: existing?.self_effort ?? 0,
    feasibility: existing?.feasibility ?? 0,
    verification: existing?.verification ?? 0,
  })
  const [checks, setChecks] = useState<Verification>({
    phone_verified: existing?.phone_verified ?? false,
    documents_checked: existing?.documents_checked ?? false,
    home_visit_done: existing?.home_visit_done ?? false,
    third_party_confirmed: existing?.third_party_confirmed ?? false,
    inconsistencies_found: existing?.inconsistencies_found ?? false,
  })
  const [decision, setDecision] = useState<Decision>(existing?.decision ?? 'pending')

  const live = useMemo(() => assess(scores, checks, weights, thresholds), [scores, checks, weights, thresholds])
  const needsReason = REASON_REQUIRED.includes(decision)

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="request_id" value={requestId} />

      {/* الدرجة الحيّة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface-2 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="num text-2xl font-semibold">{live.total}</span>
          <span className="text-xs text-faint">/ 100</span>
          <span className={`rounded px-2.5 py-0.5 text-xs font-medium ${BAND_CLS[live.band]}`}>
            {BAND_AR[live.band]}
          </span>
          {live.capped && (
            <span className="text-xs text-gold">
              (الدرجة الخام: {BAND_AR[live.rawBand]} — {live.capReason})
            </span>
          )}
        </div>
        <span className="text-xs text-faint">الدرجة تعاون القرار ولا تصنعه</span>
      </div>

      {/* المعايير */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {CRITERIA.map((c) => (
          <fieldset key={c} className="rounded border border-line p-3">
            <legend className="px-1 text-xs font-semibold">
              {RUBRIC[c].title}
              <span className="num ms-2 font-normal text-faint">
                وزن {Math.round(weights[c])} · يساهم بـ{live.contributions[c]}
              </span>
            </legend>
            <div className="mt-1 flex flex-col gap-1">
              {RUBRIC[c].levels.map((label, level) => (
                <label
                  key={level}
                  className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs leading-5 ${
                    scores[c] === level ? 'bg-brand-soft' : 'hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="radio"
                    name={`score_${c}`}
                    value={level}
                    checked={scores[c] === level}
                    onChange={() => setScores((s) => ({ ...s, [c]: level }))}
                    className="mt-0.5 accent-[#1d3a5f]"
                  />
                  <span className="num w-3 shrink-0 text-faint">{level}</span>
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {/* مدى الصحّة */}
      <div className="mt-4 rounded border border-line p-3">
        <div className="text-xs font-semibold">مدى صحّة المعطيات — شنوّة تثبّتنا منه فعلاً؟</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHECKS.map(([k, label]) => (
            <label
              key={k}
              className={`cursor-pointer rounded border px-3 py-1.5 text-xs ${
                checks[k] ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong'
              }`}
            >
              <input
                type="checkbox"
                name={k}
                checked={checks[k]}
                onChange={(e) => setChecks((v) => ({ ...v, [k]: e.target.checked }))}
                className="sr-only"
              />
              {label}
            </label>
          ))}
          <label
            className={`cursor-pointer rounded border px-3 py-1.5 text-xs ${
              checks.inconsistencies_found ? 'border-[#c0392b] bg-[#fbeeeb] text-[#8c2f22]' : 'border-line hover:border-line-strong'
            }`}
          >
            <input
              type="checkbox"
              name="inconsistencies_found"
              checked={checks.inconsistencies_found}
              onChange={(e) => setChecks((v) => ({ ...v, inconsistencies_found: e.target.checked }))}
              className="sr-only"
            />
            ⚠ تناقض في الحكاية
          </label>
        </div>
        <textarea
          name="verification_note"
          rows={2}
          defaultValue={existing?.verification_note ?? ''}
          placeholder="ماذا تثبّتنا منه، ومع من، ومتى — أو ما التناقض بالضبط"
          className="mt-2 w-full rounded border border-line bg-surface px-3 py-2 text-xs"
        />
      </div>

      {/* القرار */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">القرار</span>
          <select
            name="decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          >
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {DECISION_AR[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs text-muted">
            السبب {needsReason ? <b className="text-[#8c2f22]">— مطلوب لهذا القرار</b> : '(يُنصح به)'}
          </span>
          <input
            name="decision_reason"
            defaultValue={existing?.decision_reason ?? ''}
            required={needsReason}
            placeholder="يُقرأ بعد شهر من شخص آخر: اكتب ما يكفي ليفهم"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? 'جاري الحفظ…' : 'احفظ الدراسة'}
        </button>
        {state.ok && !pending && <span role="status" className="text-xs text-brand">✓ حُفظت وسُجّلت في الأثر</span>}
        {state.error && !pending && <span role="alert" className="text-xs text-[#8c2f22]">{state.error}</span>}
        {decision === 'accept_support' && (
          <span className="text-xs text-faint">القبول يفتح حالة مساندة غير منشورة — النشر يبقى بموافقة صاحبها</span>
        )}
      </div>
    </form>
  )
}
