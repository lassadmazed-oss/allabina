'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * زرّ التسجيل في ترويسة التليفون — في الرئيسية فقط.
 *
 * خارج الرئيسية يأخذ زرّ الرجوع مكانه: أربعة عناصر (رجوع، شعار، زرّ،
 * قائمة) لا تتّسع في 360 بكسل بالفرنسية، والزرّ موجود في القائمة وفي
 * الصفحات نفسها.
 */
export default function MobileCta({ home, href, label }: { home: string; href: string; label: string }) {
  const pathname = usePathname()
  if (pathname && pathname !== home && pathname !== `${home}/`) return null
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-brand px-4 text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(14,58,91,0.6)] transition active:bg-brand-deep"
    >
      {label}
    </Link>
  )
}
