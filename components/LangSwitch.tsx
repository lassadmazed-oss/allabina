'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LOCALES, type Locale } from '@/lib/i18n'

/** يبدّل اللغة ويبقى في نفس الصفحة — change de langue en restant sur la même page */
export default function LangSwitch({ current, other, label }: { current: Locale; other: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`
  const params = useSearchParams()

  const rest = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
    ? pathname.slice(current.length + 1)
    : pathname
  const query = params?.toString()
  const href = `/${other}${rest}${query ? `?${query}` : ''}`

  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      dir={other === 'ar' ? 'rtl' : 'ltr'}
      className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
    >
      {label}
    </Link>
  )
}
