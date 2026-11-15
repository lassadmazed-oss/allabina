'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon, { type IconName } from '@/components/admin/Icon'

/**
 * قشرة اللوحة — شريط جانبي كحلي كما في الماكيتة B01–B04.
 *
 * كان التنقّل شريطاً أفقياً فوق: ثمانية عشر رابطاً يُسحبون بالإبهام،
 * فلا يُرى الموضع ولا تُقرأ الأقسام. الماكيتة تضعهم عموداً بإيكونات،
 * والمفتوح منها مميَّز.
 *
 * والعنوان في الشريط العلوي يُشتقّ من المسار لا يُمرَّر من كلّ صفحة:
 * ثماني عشرة صفحة تُعدَّل واحدةً واحدةً تعني ثمانية عشر موضع خطأ، وصفحة
 * تُنسى تظهر بشريطٍ بلا عنوان. المسار يعرف القسم دائماً.
 *
 * وفي العربية الشريط يمين الشاشة: الترتيب في DOM هو الترتيب في RTL بلا
 * تبديل أصناف.
 */
export type ShellLink = { href: string; label: string; icon: IconName }

/** عناوين المسارات الداخلية — ما ليس رابطاً في القائمة */
const SUB_TITLES: { prefix: string; label: string; icon: IconName }[] = [
  { prefix: '/admin/chantiers/', label: 'ملفّ الورشة', icon: 'helmet' },
  { prefix: '/admin/properties/', label: 'ملفّ العقار', icon: 'building' },
  { prefix: '/admin/cases/', label: 'الحالة', icon: 'award' },
  { prefix: '/admin/support/', label: 'ملفّ المساندة', icon: 'hands' },
  { prefix: '/admin/reseau/', label: 'المتدخّل', icon: 'users' },
  { prefix: '/admin/produits/', label: 'المنتَج', icon: 'box' },
  { prefix: '/admin/bordereau/', label: 'المقال', icon: 'file' },
  { prefix: '/admin/demande/', label: 'ملفّ المطلب', icon: 'folder' },
  { prefix: '/admin/request/', label: 'ملفّ المطلب', icon: 'folder' },
]

/** الرابط المفتوح: أطول بادئة مطابقة، فـ/admin لا يبتلع /admin/chantiers */
function activeOf(pathname: string, links: ShellLink[]): ShellLink | null {
  let best: ShellLink | null = null
  for (const l of links) {
    const hit = pathname === l.href || pathname.startsWith(`${l.href}/`)
    if (hit && (!best || l.href.length > best.href.length)) best = l
  }
  return best
}

export default function AdminShell({
  links,
  staffName,
  roleLabel,
  tools,
  children,
}: {
  links: ShellLink[]
  staffName: string
  roleLabel: string
  /** أدوات الحساب: تصدير وخروج — نموذجٌ بفعل خادم يُمرَّر جاهزاً */
  tools: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)

  // تبديل الصفحة يغلق الدرج: يبقى مفتوحاً فيغطّي ما ذهبتَ إليه
  useEffect(() => setOpen(false), [pathname])

  const active = activeOf(pathname, links)
  const sub = SUB_TITLES.find((s) => pathname.startsWith(s.prefix))
  const title = sub?.label ?? active?.label ?? 'لوحة القيادة'
  const titleIcon: IconName = sub?.icon ?? active?.icon ?? 'grid'

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {links.map((l) => {
        const on = active?.href === l.href
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition ${
              on
                ? 'bg-white/12 font-semibold text-gold-light'
                : 'text-white/70 hover:bg-white/8 hover:text-white'
            }`}
          >
            <Icon name={l.icon} className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{l.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      {/* ── الشريط الجانبي: ثابت من lg، ودرجٌ تحتها ── */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 overflow-y-auto bg-brand lg:block">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
          <BrickMark />
          <span className="leading-tight">
            <span className="display block text-[15px] font-bold text-white">اللَّبنة</span>
            <span className="block text-[10px] text-white/55">البناء والتعمير</span>
          </span>
        </div>
        {nav}
      </aside>

      {open && (
        <>
          <button
            aria-label="غلق القائمة"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          />
          <aside className="fixed inset-y-0 z-50 w-[250px] overflow-y-auto bg-brand lg:hidden" style={{ insetInlineEnd: 0 }}>
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <span className="flex items-center gap-2.5">
                <BrickMark />
                <span className="display text-[15px] font-bold text-white">اللَّبنة</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="غلق"
                className="rounded p-1.5 text-white/70 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            {nav}
          </aside>
        </>
      )}

      {/* ── العمود الرئيسي ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <button
              onClick={() => setOpen(true)}
              aria-label="القائمة"
              className="rounded-lg border border-line p-2 text-muted transition hover:border-line-strong lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={titleIcon} />
              </span>
              <span className="display truncate text-lg font-semibold">{title}</span>
            </span>

            <span className="ms-auto flex items-center gap-2">
              {tools}
              <span className="hidden items-center gap-2 rounded-full border border-line py-1 ps-1 pe-3 sm:flex">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon name="user" className="h-4 w-4" />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-semibold">{staffName}</span>
                  <span className="block text-[10px] text-muted">{roleLabel}</span>
                </span>
              </span>
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

/** علامة اللَّبنة: ثلاث لبنات ذهبية */
function BrickMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <rect x="3" y="13" width="8" height="8" rx="1" fill="#D4A15E" />
        <rect x="13" y="13" width="8" height="8" rx="1" fill="#D4A15E" opacity=".75" />
        <rect x="8" y="3" width="8" height="8" rx="1" fill="#D4A15E" opacity=".9" />
      </svg>
    </span>
  )
}
