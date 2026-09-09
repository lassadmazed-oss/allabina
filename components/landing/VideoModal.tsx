'use client'

import { useEffect, useRef, useState } from 'react'
import { IcPlay } from '@/components/landing/icons'

/**
 * «تعرّف على خدماتنا»: زرّ يفتح نافذة فيديو فوق الصفحة بدل القفز إلى قسم.
 *
 * الفيديو لا يُحمَّل إلّا عند الفتح (preload=none والعنصر لا يُركَّب قبلها)،
 * فلا يثقل فتح الصفحة. تُغلق بـEsc وبالنقر خارجها، وتمنع تمرير ما خلفها.
 * الملفّ الحالي نسخة مؤقّتة مولَّدة من صور الموقع — يُبدَّل في
 * components/landing/photos.ts حين يجهز الفيديو الحقيقي.
 */
export default function VideoModal({
  label,
  title,
  note,
  closeLabel,
  src,
  poster,
}: {
  label: string
  title: string
  note?: string
  closeLabel: string
  src: string
  poster?: string
}) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn--ghost">
        {label}
        <span className="playdot">
          <IcPlay />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-deep/85 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <b className="display text-base font-bold sm:text-lg">{title}</b>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/15">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- فيديو تعريفي مؤقّت بلا كلام */}
              <video className="aspect-video w-full" src={src} poster={poster} controls autoPlay playsInline preload="none" />
            </div>
            {note && <p className="mt-3 text-center text-xs text-white/60">{note}</p>}
          </div>
        </div>
      )}
    </>
  )
}
