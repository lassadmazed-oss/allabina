import Link from 'next/link'
import DemoBadge from '@/components/DemoBadge'

/**
 * بطاقة حالة منجزة — الصورة أوّلاً.
 *
 * القاعدة البصرية: صورة واحدة كبيرة تحمل الشارات فوقها، وتحتها ثلاثة أسطر
 * لا أكثر — الصنف، العنوان، المعطيات. كلّ ما عدا ذلك يُترك لصفحة التفاصيل.
 * البطاقة كلّها رابط: لا زرّ صغير يُطارَد بالإصبع.
 */
export default function CaseCard({
  href,
  cover,
  photoCount,
  kindLabel,
  title,
  meta,
  place,
  isDemo,
  demoLabel,
  photosLabel,
}: {
  href: string
  cover: string | null
  photoCount: number
  kindLabel: string
  title: string
  meta: string
  place: string | null
  isDemo: boolean
  demoLabel: string
  photosLabel: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="brick-pattern absolute inset-0 flex items-center justify-center">
            <span className="brick" aria-hidden="true" />
          </span>
        )}

        {/* تدرّج أسفل الصورة حتى تُقرأ الشارات مهما كانت الصورة فاتحة */}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/45 to-transparent"
          aria-hidden="true"
        />

        {photoCount > 1 && (
          <span className="num absolute bottom-2 start-2 rounded bg-ink/70 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
            {photoCount} {photosLabel}
          </span>
        )}

        {isDemo && (
          <span className="absolute top-2 end-2">
            <DemoBadge label={demoLabel} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[11px] font-medium tracking-wider text-gold uppercase">
          {kindLabel}
        </span>
        <h3 className="mt-1.5 font-semibold leading-7 text-ink group-hover:text-brand">{title}</h3>
        {meta && <p className="num mt-1 text-xs text-muted">{meta}</p>}

        {place && (
          <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-faint">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
              />
            </svg>
            {place}
          </span>
        )}
      </div>
    </Link>
  )
}
