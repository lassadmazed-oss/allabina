'use client'

import { useEffect, useState } from 'react'
import { resolveMapsLinkAction } from '@/lib/actions/geo'
import {
  formatCoords,
  isInTunisia,
  isShortMapsLink,
  mapsLink,
  parseCoords,
  type Coords,
} from '@/lib/geo'
import type { Dictionary } from '@/lib/i18n'

/**
 * حقل واحد عوض حقلين. الحريف يلصق رابط خرائط قوقل — أو الإحداثيات كيفما جات —
 * ونحنا نستخرجوهم. الحقلان lat و lng يبقاو مخفيّين حتى ما يتبدّلش الخادم.
 */
export default function CoordsField({
  t,
  inputCls,
  invalid = false,
}: {
  t: Dictionary['proprietaire']
  inputCls: string
  /** الخادم رفض الإحداثيات: إطار أحمر وهدف للقفز */
  invalid?: boolean
}) {
  const [raw, setRaw] = useState('')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [resolving, setResolving] = useState(false)

  const onChange = (value: string) => {
    setRaw(value)
    setCoords(parseCoords(value))
  }

  /**
   * زرّ «مشاركة» في تطبيق الخرائط يعطي رابطاً مختصراً بلا إحداثيات.
   * كي يلصق الحريف واحداً، نفكّوه في الخادم عوض ما نقولولو «ما فهمناش».
   */
  useEffect(() => {
    const text = raw.trim()
    if (coords || !isShortMapsLink(text)) {
      setResolving(false)
      return
    }

    let cancelled = false
    setResolving(true)
    const timer = setTimeout(async () => {
      const found = await resolveMapsLinkAction(text)
      if (cancelled) return
      setResolving(false)
      if (found) setCoords(found)
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [raw, coords])

  const touched = raw.trim().length > 0
  const outside = coords && !isInTunisia(coords)

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {t.coords}
          <span className="mr-2 text-xs font-normal text-faint">{t.coordsHint}</span>
        </span>
        <input
          id="coords-input"
          type="text"
          aria-invalid={invalid || undefined}
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.coordsPlaceholder}
          dir="ltr"
          inputMode="text"
          autoComplete="off"
          className={`${inputCls} text-start ${invalid ? 'border-[#c0392b] ring-2 ring-[#c0392b]/25' : ''}`}
        />
      </label>

      <input type="hidden" name="lat" value={coords ? coords.lat : ''} />
      <input type="hidden" name="lng" value={coords ? coords.lng : ''} />

      <p className="mt-1.5 text-xs leading-6 text-faint">{t.coordsHow}</p>

      {coords && (
        <p
          role="status"
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-brand-deep"
        >
          <span>{t.coordsFound}</span>
          <span className="num" dir="ltr">
            {formatCoords(coords)}
          </span>
          <a
            href={mapsLink(coords)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            {t.coordsCheck}
          </a>
        </p>
      )}

      {coords && outside && (
        <p className="mt-2 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6 text-gold">
          {t.coordsOutside}
        </p>
      )}

      {resolving && (
        <p className="mt-2 rounded border border-line bg-surface-2 px-3 py-2 text-xs leading-6 text-muted">
          {t.coordsResolving}
        </p>
      )}

      {touched && !coords && !resolving && (
        <p className="mt-2 rounded border border-line bg-surface-2 px-3 py-2 text-xs leading-6 text-muted">
          {t.coordsNotFound}
        </p>
      )}
    </div>
  )
}
