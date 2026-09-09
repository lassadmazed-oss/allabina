'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavLink } from '@/components/MobileNav'
import { IcArrow, IcChevron } from '@/components/landing/icons'

export type DesktopNavItem =
  /** showFrom: الرابط المباشر يظهر من هذا المقاس فقط — تحته يكفي وجوده في القائمة المنسدلة */
  | { kind: 'link'; href: string; label: string; showFrom?: 'xl' }
  /** hideFrom: العنصر في القائمة يختفي من هذا المقاس (لأنّ رابطه المباشر ظهر) */
  | { kind: 'menu'; label: string; links: (NavLink & { hideFrom?: 'xl' })[] }

/**
 * قائمة الحاسوب.
 *
 * كانت تسعة روابط في سطر واحد بخطّ 13px: تركب على الشعار وتقصّ زرّ التسجيل
 * من 1440 بكسل فما تحت. هنا أربعة عناصر لا غير — رابطان مباشران وقائمتان
 * منسدلتان («اعرف أكثر» و«شارك معانا») بنفس تجميع قائمة التليفون والتذييل.
 *
 * القائمة تُفتح بالمرور وبالنقر وبلوحة المفاتيح، وتُغلق بـEsc وبالنقر خارجها
 * وبخروج التركيز وبتبدّل الصفحة. خطّ ذهبي تحت الصفحة الحالية. وتضع سمة
 * data-scrolled على الترويسة بعد التمرير حتى يظهر ظلّها.
 */
export default function DesktopNav({ items }: { items: DesktopNavItem[] }) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState<number | null>(null)
  const root = useRef<HTMLUListElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // تبديل الصفحة يغلق القائمة
  useEffect(() => setOpen(null), [pathname])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  // ظلّ الترويسة بعد التمرير — السمة على أقرب <header>، والقاعدة في الترويسة نفسها
  useEffect(() => {
    const header = root.current?.closest('header')
    if (!header) return
    const onScroll = () => header.toggleAttribute('data-scrolled', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      header.removeAttribute('data-scrolled')
    }
  }, [])

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const enter = (i: number) => {
    cancel()
    setOpen(i)
  }
  // مهلة قصيرة: الفأرة تعبر الفراغ بين الزرّ واللوحة دون أن تُغلق
  const leave = () => {
    cancel()
    timer.current = setTimeout(() => setOpen(null), 160)
  }

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const item =
    'relative inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold transition-colors xl:px-3.5 xl:text-[15px]'
  const idle = 'text-brand-deep/75 hover:text-brand'
  // الخطّ الذهبي تحت الصفحة الحالية
  const line =
    "after:absolute after:inset-x-2.5 xl:after:inset-x-3.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-gold-light after:transition-opacity after:content-['']"

  return (
    <ul ref={root} className="flex items-center gap-0.5 xl:gap-1">
      {items.map((it, i) => {
        if (it.kind === 'link') {
          const cur = isCurrent(it.href)
          return (
            <li key={it.href} className={it.showFrom === 'xl' ? 'hidden xl:block' : undefined}>
              <Link
                href={it.href}
                aria-current={cur ? 'page' : undefined}
                className={`${item} ${line} ${cur ? 'text-brand after:opacity-100' : `${idle} after:opacity-0`}`}
              >
                {it.label}
              </Link>
            </li>
          )
        }

        const on = open === i
        const cur = it.links.some((l) => isCurrent(l.href))
        return (
          <li
            key={it.label}
            className="relative"
            onMouseEnter={() => enter(i)}
            onMouseLeave={leave}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null)
            }}
          >
            <button
              type="button"
              aria-expanded={on}
              aria-controls={`dnav-${i}`}
              onClick={() => setOpen(on ? null : i)}
              className={`${item} ${line} ${cur ? 'text-brand after:opacity-100' : `${idle} after:opacity-0`} ${on ? 'text-brand' : ''}`}
            >
              {it.label}
              <IcChevron className={`size-4 transition-transform duration-200 ${on ? 'rotate-180' : ''}`} />
            </button>
            {/* اللوحة تبقى في الصفحة (روابطها في HTML)؛ الظهور بالشفافية والانزلاق */}
            <div
              id={`dnav-${i}`}
              className={`absolute start-0 top-full z-50 pt-2 transition-[opacity,transform,visibility] duration-150 ${
                on ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
              }`}
            >
              <div className="min-w-60 rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_60px_-24px_rgba(14,58,91,0.45)]">
                {it.links.map((l) => {
                  const active = isCurrent(l.href)
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center justify-between gap-4 rounded-xl px-3.5 text-[15px] font-medium transition ${
                        active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-brand-soft/70 hover:text-brand'
                      } ${l.hideFrom === 'xl' ? 'xl:hidden' : ''}`}
                    >
                      {l.label}
                      <IcArrow className="size-4 shrink-0 text-gold rtl:-scale-x-100" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
