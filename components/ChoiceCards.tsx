import Link from 'next/link'
import Icon, { type IconName } from '@/components/Icon'
import { Check } from '@/components/ProjectTypeCards'

/**
 * بطاقات اختيار — الشكل الذي تكرّره الماكيتة ثلاث مرّات في F02/F03:
 * نوع المشروع، ونطاق الأشغال، والتشطيبات.
 *
 * مكتوبةً ثلاث مرّات تصير ثلاثة أشكال بلا أن يقرّر أحد ذلك: واحدةٌ
 * بحاشية رفيعة وأخرى بعريضة، وعلامةُ اختيارٍ هنا ولا شيء هناك.
 */
export type Choice = {
  key: string
  label: string
  hint?: string
  icon: IconName
}

export default function ChoiceCards({
  choices,
  selected,
  hrefOf,
  columns = 3,
}: {
  choices: readonly Choice[]
  selected: string
  hrefOf: (key: string) => string
  columns?: 2 | 3
}) {
  return (
    <ul className={`grid gap-2.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {choices.map((c) => {
        const on = c.key === selected
        return (
          <li key={c.key}>
            <Link
              href={hrefOf(c.key)}
              aria-current={on ? 'true' : undefined}
              className={`relative flex h-full flex-col items-center rounded-xl border-2 p-3 text-center transition ${
                on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              {on && (
                <span
                  className="absolute top-2 grid size-5 place-items-center rounded-full bg-brand text-white"
                  style={{ insetInlineEnd: '0.5rem' }}
                >
                  <Check className="h-3 w-3" width={3.5} />
                </span>
              )}
              <span
                className={`grid size-10 place-items-center rounded-lg ${
                  on ? 'bg-brand text-white' : 'bg-gold-soft text-gold'
                }`}
              >
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="mt-2 text-sm font-semibold leading-tight">{c.label}</span>
              {c.hint && (
                <span className="mt-0.5 text-[11px] leading-5 text-muted">{c.hint}</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * صفٌّ بإيكونة وعنوان وحقل — «Localisation [Sfax ▾]» في الماكيتة.
 * العنوان على اليمين والحقل يملأ الباقي، فتُقرأ الأسطر عموداً واحداً.
 */
export function FieldRow({
  icon,
  label,
  children,
}: {
  icon: IconName
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-medium sm:w-40">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  )
}
