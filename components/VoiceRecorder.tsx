'use client'

import { useEffect, useRef, useState } from 'react'
import { createVoiceSlot, discardVoiceDraft } from '@/lib/actions/voice-note'
import { MAX_SECONDS, baseMime, formatDuration } from '@/lib/voice-note'

/**
 * تسجيل صوتي بجانب خانة نصّ.
 *
 * لماذا: «حكيلنا على مشكلتك بكلامك» تفترض الكتابة. ومن كبر في السنّ،
 * ومن يقرأ ولا يكتب بيسر، ومن الدارجة عنده أسهل نطقاً منها كتابةً —
 * يتركها فارغة. فيصل الملفّ بلا حكايته وهي أهمّ ما فيه.
 *
 * التسجيل **يزيد ولا يعوّض**: النصّ يبقى للبحث والفرز، والصوت يُسمَع.
 *
 * الرفع مباشر إلى المخزن برابط يوقّعه الخادم: ملفّ صوتي من هاتف قد
 * يتجاوز حدّ جسم الطلب في الاستضافة، والخادم لا يحمل الملفّ أصلاً.
 */

type Phase = 'idle' | 'asking' | 'recording' | 'uploading' | 'ready' | 'error'

export type VoiceStrings = {
  /** «سجّل صوتك» */
  start: string
  stop: string
  again: string
  remove: string
  recording: string
  uploading: string
  ready: string
  hint: string
  denied: string
  unsupported: string
  failed: string
  /** «الحدّ 3 دقائق» */
  limit: string
}

/** أوّل نوع يدعمه هذا المتصفّح — Safari لا يعرف webm وChrome لا يعرف mp4 */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const wanted = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return wanted.find((m) => MediaRecorder.isTypeSupported(m))
}

export default function VoiceRecorder({
  name,
  t,
  initialToken = '',
}: {
  /** اسم الحقل المخفي الذي يحمل رمز المسوّدة إلى الاستمارة */
  name: string
  t: VoiceStrings
  initialToken?: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [token, setToken] = useState(initialToken)
  const [path, setPath] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [message, setMessage] = useState('')
  const [supported, setSupported] = useState(true)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const tickRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)

  // الدعم يُفحص بعد التركيب لا أثناء العرض: الخادم لا يملك MediaRecorder
  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        Boolean(pickMime())
    )
  }, [])

  // ترك الميكروفون مفتوحاً بعد مغادرة الصفحة خرق للخصوصية لا تسريب ذاكرة
  useEffect(
    () => () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const stopTicking = () => {
    if (tickRef.current) window.clearInterval(tickRef.current)
    tickRef.current = null
  }

  async function upload(blob: Blob, elapsed: number) {
    setPhase('uploading')

    // MediaRecorder يعيد `audio/webm;codecs=opus`، والمخزن يقارن النوع
    // حرفياً بقائمته فيردّ الملفّ. المعامل يُقصّ قبل التوقيع وقبل الرفع
    // معاً — لو قُصّ في واحد دون الآخر لاختلف المسار عن المحتوى.
    const mime = baseMime(blob.type) || 'audio/webm'

    const slot = await createVoiceSlot({
      token: token || undefined,
      mime,
      bytes: blob.size,
      seconds: elapsed,
    })

    if (!slot.ok) {
      setPhase('error')
      setMessage(t.failed)
      return
    }

    const res = await fetch(slot.url, {
      method: 'PUT',
      headers: { 'content-type': mime },
      body: blob,
    }).catch(() => null)

    if (!res?.ok) {
      console.warn('voice upload failed', res?.status, mime)
      setPhase('error')
      setMessage(t.failed)
      return
    }

    setToken(slot.token)
    setPath(slot.path)
    setPreviewUrl(URL.createObjectURL(blob))
    setPhase('ready')
    setMessage('')
  }

  async function start() {
    setMessage('')
    setPhase('asking')
    const mimeType = pickMime()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // الرفض والانعدام يعطيان نفس الاستثناء — نقول «لم يُسمح» وهو الأشيع
      setPhase('error')
      setMessage(t.denied)
      return
    }

    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = rec
    chunksRef.current = []

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      stopTicking()
      stream.getTracks().forEach((tr) => tr.stop())
      const elapsed = (Date.now() - startedAtRef.current) / 1000
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
      setSeconds(elapsed)
      void upload(blob, elapsed)
    }

    startedAtRef.current = Date.now()
    setSeconds(0)
    rec.start()
    setPhase('recording')

    tickRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000
      setSeconds(elapsed)
      // الحدّ يوقف التسجيل بنفسه: من ينسى لا يخسر ما سجّله
      if (elapsed >= MAX_SECONDS) rec.stop()
    }, 250)
  }

  const stop = () => recorderRef.current?.stop()

  async function remove() {
    if (token && path) await discardVoiceDraft(token, path)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setPath('')
    setSeconds(0)
    setPhase('idle')
  }

  if (!supported) {
    return (
      <p className="mt-2 text-xs leading-6 text-faint">{t.unsupported}</p>
    )
  }

  const btn =
    'inline-flex min-h-10 items-center gap-2 rounded border px-3.5 text-sm transition'

  return (
    <div className="mt-3">
      {/* الرمز وحده يسافر مع الاستمارة: الملفّ في المخزن، والخادم يقرأه منه */}
      <input type="hidden" name={name} value={phase === 'ready' ? token : ''} />

      {phase === 'ready' && previewUrl ? (
        <div className="rounded border border-line bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              {t.ready}
              <span className="num text-xs text-muted">{formatDuration(seconds)}</span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={start}
                className={`${btn} border-line text-muted hover:border-brand hover:text-brand`}
              >
                {t.again}
              </button>
              <button
                type="button"
                onClick={remove}
                className={`${btn} border-line text-muted hover:border-[#c0796b] hover:text-[#8c2f22]`}
              >
                {t.remove}
              </button>
            </span>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={previewUrl} controls className="mt-2 w-full" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {phase === 'recording' ? (
            <button
              type="button"
              onClick={stop}
              className={`${btn} border-[#c0796b] bg-[#fbeeeb] text-[#8c2f22]`}
            >
              <span
                className="size-2.5 animate-pulse rounded-full bg-[#8c2f22]"
                aria-hidden="true"
              />
              {t.stop}
              <span className="num text-xs">
                {formatDuration(seconds)} / {formatDuration(MAX_SECONDS)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={phase === 'asking' || phase === 'uploading'}
              className={`${btn} border-line bg-surface text-muted hover:border-brand hover:text-brand disabled:opacity-50`}
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M10 12a3 3 0 0 0 3-3V4a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 0-2 0 3 3 0 0 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V16H7a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1A5 5 0 0 0 15 9Z"
                />
              </svg>
              {phase === 'uploading' ? t.uploading : t.start}
            </button>
          )}

          <span className="text-xs leading-6 text-faint">
            {phase === 'recording' ? t.recording : `${t.hint} · ${t.limit}`}
          </span>
        </div>
      )}

      {message && <p className="mt-2 text-xs leading-6 text-[#8c2f22]">{message}</p>}
    </div>
  )
}
