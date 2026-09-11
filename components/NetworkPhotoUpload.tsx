'use client'

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { uploadNetworkPhotosAction, type NetworkPhotoState } from '@/lib/actions/network-photos'
import { MAX_PHOTO_BYTES } from '@/lib/photos'
import {
  MAX_NETWORK_PHOTOS_PER_UPLOAD,
  NETWORK_PHOTO_KINDS,
  NETWORK_PHOTO_KIND_AR,
  NETWORK_PHOTO_KIND_HINT,
  type NetworkPhotoKind,
} from '@/lib/network-photos'

const ERRORS: Record<NonNullable<NetworkPhotoState['error']>, string> = {
  type: 'النوع غير مقبول: JPG أو PNG أو WebP فقط.',
  size: `صورة أكبر من ${MAX_PHOTO_BYTES / 1024 / 1024} ميغا. صغّرها قبل الرفع.`,
  empty: 'اختار صورة واحدة على الأقلّ.',
  profile: 'الملفّ ما عادش موجود. حدّث الصفحة.',
  server: 'صار مشكل تقني في الرفع. عاود المحاولة.',
  forbidden: 'ما عندكش صلاحية الرفع.',
  too_many: 'ستّ صور على الأكثر في الدفعة الواحدة.',
}

/** حدّ جسم الطلب 16 ميغا: نمنع الدفعة الثقيلة قبل ما تمشي للخادم */
const BATCH_LIMIT = 15 * 1024 * 1024
const HEAVY = 'الدفعة أثقل من 15 ميغا — ارفعها على دفعتين.'

const PLACEHOLDER: Record<NetworkPhotoKind, string> = {
  work: 'تعليق (اختياري): مثال صبّة دالة فيلا في ساقية الزيت',
  product: 'تعليق (اختياري): مثال بلوك 20 سم · بلاطات جاهزة للسقف',
}

const initial: NetworkPhotoState = { ok: false }

/**
 * رفع صور أعمال المتدخّل أو منتوجات المزوّد.
 *
 * full: في الملفّ الكامل — النوع والتعليق قبل الرفع.
 * slot / overlay: في بطاقة القائمة — زرّ واحد يرفع حال اختيار الصور، بنوع
 * العائلة (المزوّد منتوجات، البقيّة أعمال). التعليق والنوع يتبدّلان بعدها من الملفّ.
 */
export default function NetworkPhotoUpload({
  intervenantId,
  defaultKind,
  variant = 'full',
}: {
  intervenantId: string
  defaultKind: NetworkPhotoKind
  variant?: 'full' | 'slot' | 'overlay'
}) {
  const [state, action, pending] = useActionState(uploadNetworkPhotosAction, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState<NetworkPhotoKind>(defaultKind)
  const [picked, setPicked] = useState({ count: 0, bytes: 0 })
  const [localError, setLocalError] = useState<string | null>(null)
  const compact = variant !== 'full'

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      setPicked({ count: 0, bytes: 0 })
    }
  }, [state])

  const tooHeavy = picked.bytes > BATCH_LIMIT
  const tooMany = picked.count > MAX_NETWORK_PHOTOS_PER_UPLOAD

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const next = { count: files.length, bytes: files.reduce((s, f) => s + f.size, 0) }
    setPicked(next)
    if (!compact || !next.count) return
    // في البطاقة لا زرّ «ارفع»: نتحقّق هنا ثمّ نرسل مباشرة
    const blocked = next.count > MAX_NETWORK_PHOTOS_PER_UPLOAD ? ERRORS.too_many : next.bytes > BATCH_LIMIT ? HEAVY : null
    setLocalError(blocked)
    if (blocked) {
      e.target.value = ''
      return
    }
    formRef.current?.requestSubmit()
  }

  if (compact) {
    const message = localError ?? (state.error && !pending ? ERRORS[state.error] : null)
    const overlay = variant === 'overlay'
    return (
      <form ref={formRef} action={action} className={overlay ? 'relative' : 'flex flex-col items-center gap-1'}>
        <input type="hidden" name="intervenant_id" value={intervenantId} />
        <input type="hidden" name="kind" value={defaultKind} />
        <label
          title={`أضف صور ${NETWORK_PHOTO_KIND_AR[defaultKind]}`}
          aria-busy={pending}
          className={`${
            overlay
              ? 'flex size-9 items-center justify-center rounded-full bg-white/90 text-brand-deep shadow ring-1 ring-black/5 hover:bg-white'
              : 'inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-medium text-white hover:bg-brand-deep'
          } cursor-pointer transition ${pending ? 'pointer-events-none opacity-70' : ''}`}
        >
          {pending ? <Spinner /> : <CameraPlus />}
          {overlay ? (
            <span className="sr-only">أضف صور {NETWORK_PHOTO_KIND_AR[defaultKind]}</span>
          ) : (
            <span>{pending ? 'جاري الرفع…' : `أضف صور ${NETWORK_PHOTO_KIND_AR[defaultKind]}`}</span>
          )}
          <input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} />
        </label>
        {message && (
          <p
            role="alert"
            className={
              overlay
                ? 'absolute bottom-full end-0 mb-1.5 w-52 rounded-lg bg-surface px-2 py-1 text-[11px] leading-5 text-[#8c2f22] shadow-md'
                : 'max-w-[15rem] text-center text-[11px] leading-5 text-[#8c2f22]'
            }
          >
            {message}
          </p>
        )}
      </form>
    )
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="intervenant_id" value={intervenantId} />
      {/* النوع في حقل مخفي لا في أزرار راديو: إعادة ضبط النموذج بعد الرفع لا تمسّه */}
      <input type="hidden" name="kind" value={kind} />
      <div role="group" aria-label="نوع الصور" className="grid grid-cols-2 gap-2">
        {NETWORK_PHOTO_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`flex flex-col items-start rounded-xl border px-3 py-2 text-start transition ${
              kind === k ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:border-line-strong'
            }`}
          >
            <span className="text-sm font-medium">{NETWORK_PHOTO_KIND_AR[k]}</span>
            <span className="text-[11px] text-faint">{NETWORK_PHOTO_KIND_HINT[k]}</span>
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-ground px-4 py-5 text-center transition hover:border-brand">
        <CameraPlus className="size-[26px] text-muted" />
        <span className="text-sm font-medium text-brand">
          {picked.count ? `${picked.count} صورة مختارة` : `اختار صور ${NETWORK_PHOTO_KIND_AR[kind]}`}
        </span>
        <span className="text-[11px] text-faint">JPG · PNG · WebP — حتى ستّ صور في الدفعة</span>
        <input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} />
      </label>
      <input
        name="caption_ar"
        maxLength={200}
        placeholder={PLACEHOLDER[kind]}
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || !picked.count || tooHeavy || tooMany}
          className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-50"
        >
          {pending ? 'جاري الرفع…' : 'ارفع الصور'}
        </button>
        {state.ok && !pending && (
          <span role="status" className="text-xs text-[#1f6b3f]">
            ✓ رُفعت <span className="num">{state.uploaded}</span> صورة
          </span>
        )}
      </div>
      {(tooHeavy || tooMany) && (
        <p role="alert" className="rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold">
          {tooMany ? ERRORS.too_many : HEAVY}
        </p>
      )}
      {state.error && !pending && (
        <p role="alert" className="rounded-lg bg-[#fbeeeb] px-3 py-2 text-xs text-[#8c2f22]">
          {ERRORS[state.error]}
        </p>
      )}
      <p className="text-[11px] leading-5 text-faint">
        صور يبعثها المتدخّل على الواتساب أو يصوّرها الفريق في الحضيرة. داخلية: ما تظهرش في الموقع ولا للحرفاء. بلا وجوه ولا لوحات أرقام.
      </p>
    </form>
  )
}

function CameraPlus({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px] animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
