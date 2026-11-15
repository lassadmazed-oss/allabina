import Link from 'next/link'
import type { IconName } from '@/components/Icon'
import ProjectArt from '@/components/ProjectArt'
import { PROJECT_TYPES, type ProjectType as ProjectTypeKey } from '@/lib/project-kind'

/**
 * كروت أنواع المشروع — الماكيتة F01 (الواجهة) وF02 (الخطوة الأولى).
 *
 * مصدرٌ واحد لأنّ الماكيتة تعرضها في موضعين: من يبدّل نوعاً في أحدهما
 * ولا يبدّله في الآخر يصنع قائمتين مختلفتين لنفس السؤال — والحريف يقرأ
 * الاختلاف ارتباكاً لا تنوّعاً.
 */
export { PROJECT_TYPES, type ProjectType as ProjectTypeKey } from '@/lib/project-kind'

export const PROJECT_TYPE_ICON: Record<ProjectTypeKey, IconName> = {
  maison: 'home',
  immobilier: 'building',
  usine: 'factory',
  commerce: 'store',
  renovation: 'wrench',
  autre: 'sparkle',
}

/** إيكونة نوعٍ جاء من العنوان: قيمة غريبة تعطي الرمز العامّ لا تُسقط الصفحة */
export const projectTypeIcon = (k: string): IconName =>
  PROJECT_TYPE_ICON[k as ProjectTypeKey] ?? 'folder'

export default function ProjectTypeCards({
  names,
  hints,
  hrefOf,
  selected,
  compact = false,
  types = PROJECT_TYPES,
}: {
  names: Record<string, string>
  hints?: Record<string, string>
  hrefOf: (k: ProjectTypeKey) => string
  selected?: string | null
  /** في الواجهة: بلا شرح تحت الاسم — الصفحة طويلة والسؤال واحد */
  compact?: boolean
  /** ما يُعرض — يتبدّل بتبدّل «فرد/محترف» */
  types?: readonly ProjectTypeKey[]
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {types.map((k) => {
        const on = selected === k
        return (
          <li key={k}>
            <Link
              href={hrefOf(k)}
              className={`relative flex h-full flex-col items-center rounded-xl border-2 p-4 text-center transition hover:border-line-strong ${
                on ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
              }`}
            >
              {on && (
                <span
                  className="absolute top-2.5 grid size-5 place-items-center rounded-full bg-brand text-white"
                  style={{ insetInlineEnd: '0.625rem' }}
                >
                  <Check className="h-3 w-3" width={3.5} />
                </span>
              )}
              {/* رسمٌ ملوّن لا أيقونة خطّية: الخطّ الرفيع يقول «أيقونة»، والرسم يقول «هذا أنت» */}
              <span
                className={`grid size-14 place-items-center rounded-xl ${on ? 'bg-brand-soft' : 'bg-ground'}`}
              >
                <ProjectArt name={k} className="h-9 w-9" />
              </span>
              <span className="mt-2.5 font-semibold">{names[k] ?? k}</span>
              {!compact && hints?.[k] && (
                <span className="mt-0.5 text-sm leading-6 text-muted">{hints[k]}</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** علامة الاختيار — نفس الرسم في المؤشّر وفي البطاقة */
export function Check({ className = 'h-3.5 w-3.5', width = 3 }: { className?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
