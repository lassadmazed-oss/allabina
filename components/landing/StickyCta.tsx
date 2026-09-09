'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** زرّ ثابت أسفل الشاشة على الهاتف — يظهر بعد تجاوز الواجهة الأولى */
export default function StickyCta({ href, label }: { href: string; label: string }) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const onScroll = () => setOn(window.scrollY > 560)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`lp-sticky${on ? ' is-on' : ''}`} aria-hidden={!on}>
      <Link href={href} className="btn btn--gold" tabIndex={on ? 0 : -1}>
        {label}
      </Link>
    </div>
  )
}
