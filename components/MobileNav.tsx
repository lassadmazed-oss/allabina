'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string }
export type NavGroup = { title: string; links: NavLink[] }

/**
 * قائمة التليفون.
 *
 * قبلها كانت الترويسة تخبّي خمسة روابط من تسعة بـ«hidden lg:inline» بلا بديل:
 * خمس صفحات لا يوصلها صاحب التليفون إلّا إن نزل إلى الذيل. هنا تُعرض كلّها
 * مجمّعة بمنطق الرحلة — ابدا · اعرف · شارك — لا بترتيب الترويسة.
 *
 * تُغلق بـEsc وبالنقر خارجها وبتبدّل الصفحة، وتمنع تمرير ما خلفها.
 *
 * اللوحة تُرسم في بوابة على body لا داخل الترويسة: الترويسة فيها
 * backdrop-filter، وهو يجعل كلّ عنصر fixed داخلها يتموضع نسبةً للترويسة
 * لا للشاشة — فكانت القائمة تنفتح محشورة في شريط ارتفاعه 64 بكسل.
 */
export default function MobileNav({
  groups,
  cta,
  freeNote,
  langSwitch,
  labels,
}: {
  groups: NavGroup[]
  cta: NavLink
  /** «بدون معاليم» تحت زرّ التسجيل */
  freeNote?: string
  /** مبدّل اللغة كما هو — لا نكرّر منطق حساب رابطه هنا */
  langSwitch: React.ReactNode
  labels: { menuTitle: string; menuOpen: string; menuClose: string }
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // تبديل الصفحة يغلق القائمة: بلا هذا تبقى مفتوحة فوق الصفحة الجديدة
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const isActive = (href: string) => pathname === href

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.menuOpen}
        aria-expanded={open}
        className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong/60 bg-surface/70 text-brand transition active:scale-95 lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/* open لا يصير true إلّا بعد نقرة في المتصفّح، فـdocument موجود دائماً هنا */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-ink/45 lg:hidden"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={labels.menuTitle}
              onClick={(e) => e.stopPropagation()}
              className="ms-auto flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-surface shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
                <span className="display text-base font-semibold text-brand-deep">{labels.menuTitle}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={labels.menuClose}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-line text-muted transition active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-6 px-5 py-6">
                {groups.map((g) => (
                  <div key={g.title}>
                    <div className="mb-2 text-xs font-medium tracking-wide text-faint">{g.title}</div>
                    <ul className="flex flex-col">
                      {g.links.map((l) => (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            className={`flex min-h-12 items-center rounded-lg px-3 text-[15px] transition ${
                              isActive(l.href)
                                ? 'bg-brand-soft font-medium text-brand'
                                : 'text-ink-soft active:bg-surface-2'
                            }`}
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>

              <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-5 py-4">
                <Link
                  href={cta.href}
                  className="flex min-h-12 flex-col items-center justify-center rounded-lg bg-brand px-5 py-2 font-medium text-white transition active:bg-brand-deep"
                >
                  {cta.label}
                  {/* «قدّاش تاخذو منّي؟» — الجواب على الزرّ نفسه */}
                  {freeNote && <span className="text-[11px] font-normal opacity-85">{freeNote}</span>}
                </Link>
                <div className="flex justify-center [&>a]:flex [&>a]:min-h-11 [&>a]:w-full [&>a]:items-center [&>a]:justify-center [&>a]:text-sm">
                  {langSwitch}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
