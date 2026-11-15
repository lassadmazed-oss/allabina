import Link from 'next/link'
import Icon, { type IconName } from '@/components/Icon'
import { isolateNumbers } from '@/lib/format'

/**
 * قطع اللوحة المشتركة — الماكيتة B01–B04.
 *
 * ثلاث شاشات تكتب نفس البطاقة بثلاث طرق تصير ثلاث شاشات مختلفة بلا أن
 * يقرّر أحد ذلك. فالبطاقة والشارة والرسم هنا مرّةً واحدة.
 */

// الشارة والإيكونات مشتركتان مع الواجهة — محلّهما components/
export { default as Pill, type Tone } from '@/components/Pill'

// ───────────────────────────────────────────── بطاقة عدد

export function StatCard({
  label,
  value,
  icon,
  href,
  note,
}: {
  label: string
  value: number | string
  icon: IconName
  href?: string
  note?: string
}) {
  const body = (
    <>
      <span className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
        <span className="mt-0.5 text-xs leading-5 text-muted">{label}</span>
      </span>
      <span className="num mt-2 block text-[28px] leading-none font-semibold">
        {isolateNumbers(String(value))}
      </span>
      {note && <span className="mt-1.5 block text-[11px] leading-5 text-faint">{note}</span>}
    </>
  )

  const cls =
    'flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong'

  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// ───────────────────────────────────────────── لوح

export function Panel({
  title,
  icon,
  action,
  note,
  children,
  className = '',
}: {
  title: string
  icon?: IconName
  action?: React.ReactNode
  note?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2">
          {icon && (
            <span className="text-gold">
              <Icon name={icon} className="h-[18px] w-[18px]" />
            </span>
          )}
          <span className="leading-tight">
            <h2 className="text-sm font-semibold">{title}</h2>
            {note && <span className="block text-[11px] text-faint">{note}</span>}
          </span>
        </span>
        {action}
      </div>
      {children}
    </section>
  )
}

// ───────────────────────────────────────────── وسم بيانات العرض

/**
 * «بيانات عرض» — كما في رأس الماكيتة.
 *
 * رقمٌ مصنوع يُعرض بلا وسمٍ يصير قراراً. والوسم يُكتب حيث يُقرأ الرقم لا
 * في حاشيةٍ أسفل الصفحة.
 */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#ecdcb8] bg-gold-soft px-2.5 py-0.5 text-[11px] font-medium text-gold ${className}`}
    >
      <Icon name="info" className="h-3.5 w-3.5" strokeWidth={1.8} />
      بيانات عرض
    </span>
  )
}

// ───────────────────────────────────────────── رسم الأعمدة

/**
 * أعمدة رأسية كما في B01. والمحور يبدأ من الصفر دائماً — عمودٌ مقطوع من
 * أسفله يضاعف الفرق في العين بلا أن يتغيّر في الرقم.
 */
export function ColumnChart({
  data,
  height = 132,
}: {
  data: { label: string; value: number }[]
  height?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  // سقفٌ مستدير: 12 لا 11، فتُقرأ الخطوط
  const top = Math.max(4, Math.ceil(max / 4) * 4)
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top]

  return (
    <div className="mt-4 flex gap-2">
      <ul className="flex flex-col-reverse justify-between py-0.5 text-[10px] text-faint" style={{ height }}>
        {ticks.map((t) => (
          <li key={t} className="num leading-none">
            {isolateNumbers(String(t))}
          </li>
        ))}
      </ul>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-x-0 border-t border-line"
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <ol className="absolute inset-0 flex items-end justify-around gap-2">
            {data.map((d) => (
              <li
                key={d.label}
                className="group relative flex w-full max-w-12 justify-center"
                style={{ height: '100%' }}
                title={`${d.label}: ${d.value}`}
              >
                <span
                  className="mt-auto w-full rounded-t bg-gold-light"
                  style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }}
                />
              </li>
            ))}
          </ol>
        </div>
        <ol className="flex justify-around gap-2 pt-1.5">
          {data.map((d) => (
            <li
              key={d.label}
              className="w-full max-w-12 truncate text-center text-[10px] leading-4 text-muted"
              title={d.label}
            >
              {d.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────── تابات

/**
 * تابات بروابط لا بحالة في المتصفّح — الماكيتة B02/B04.
 *
 * التاب المفتوح في العنوان: يُشارَك، ويُحفظ، ويرجع إليه زرّ الرجوع. وحالةٌ
 * في الذاكرة تضيع عند أوّل حفظ، فيجد المسؤول نفسه في تابٍ غير الذي كان
 * فيه بعد كلّ فعل.
 *
 * والعدد على التاب يُقرأ قبل الفتح: تابٌ فارغ لا يُفتح عبثاً.
 */
export function Tabs({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string; count?: number; icon?: IconName }[]
  active: string
}) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition ${
              on
                ? 'bg-brand font-semibold text-white'
                : 'border border-line bg-surface text-muted hover:border-line-strong'
            }`}
          >
            {t.icon && <Icon name={t.icon} className="h-4 w-4" />}
            {t.label}
            {t.count !== undefined && (
              <span
                className={`num rounded-full px-1.5 text-[11px] ${
                  on ? 'bg-white/20' : t.count > 0 ? 'bg-gold-soft text-gold' : 'bg-surface-2'
                }`}
              >
                {isolateNumbers(String(t.count))}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
