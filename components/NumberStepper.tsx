'use client'

import { useId, useState } from 'react'

/**
 * «Chambres − 2 +» — الماكيتة F03.
 *
 * على التليفون، كتابة رقمٍ تعني لوحة مفاتيح تغطّي نصف الشاشة لتبديل
 * اثنين إلى ثلاثة. الزرّان أسرع، ويمنعان الخطأ: لا نصّ ولا فاصلة ولا
 * سالب.
 *
 * والخانة تبقى قابلة للكتابة لمن يريد قفزة: من عنده ثماني غرف لا
 * يضغط ستّ مرّات.
 */
export default function NumberStepper({
  name,
  defaultValue,
  min = 0,
  max = 20,
}: {
  name: string
  defaultValue: number
  min?: number
  max?: number
}) {
  const [v, setV] = useState(() => clamp(defaultValue, min, max))
  const id = useId()

  const step = (by: number) => setV((x) => clamp(x + by, min, max))

  return (
    <span className="flex items-stretch overflow-hidden rounded-lg border border-line bg-surface">
      <StepBtn label="−" onClick={() => step(-1)} disabled={v <= min} controls={id} />
      <input
        id={id}
        name={name}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          setV(Number.isFinite(n) ? clamp(n, min, max) : min)
        }}
        inputMode="numeric"
        aria-label={name}
        className="num w-full min-w-0 border-x border-line bg-surface py-2 text-center text-sm font-semibold"
      />
      <StepBtn label="+" onClick={() => step(1)} disabled={v >= max} controls={id} />
    </span>
  )
}

function StepBtn({
  label,
  onClick,
  disabled,
  controls,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  controls: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-controls={controls}
      aria-label={label === '+' ? 'زيد' : 'نقّص'}
      className="grid w-11 shrink-0 place-items-center text-lg font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-30"
    >
      {label}
    </button>
  )
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))
