'use client'

import { useRef, useState } from 'react'
import { createUploadSlot, discardDraftFile } from '@/lib/actions/property-media'
import {
  ALLOWED_MEDIA_MIME,
  MAX_PHOTOS,
  MAX_VIDEOS,
  humanBytes,
  kindOfMime,
  maxBytesFor,
  mediaRejection,
  type MediaKind,
} from '@/lib/property-media'

export type MediaStrings = {
  title: string
  hint: string
  pick: string
  limits: string
  uploading: string
  done: string
  remove: string
  errType: string
  errSize: string
  errTooMany: string
  errServer: string
  private: string
}

type Item = {
  key: string
  name: string
  kind: MediaKind
  bytes: number
  preview: string | null
  path?: string
  state: 'uploading' | 'done' | 'error'
  error?: string
}

export default function PropertyMediaUpload({ t }: { t: MediaStrings }) {
  const [token, setToken] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // الرمز يُقرأ داخل الرفع المتوازي قبل أن يلتقط React التحديث
  const tokenRef = useRef('')

  const counts = (kind: MediaKind) =>
    items.filter((i) => i.kind === kind && i.state !== 'error').length

  async function upload(file: File) {
    const kind = kindOfMime(file.type)
    const reason = mediaRejection(file.type, file.size)

    if (!kind || reason === 'type') return setNotice(t.errType)
    if (reason === 'size')
      return setNotice(`${t.errSize} — ${humanBytes(maxBytesFor(kind))}`)
    if (reason) return setNotice(t.errServer)

    const cap = kind === 'video' ? MAX_VIDEOS : MAX_PHOTOS
    if (counts(kind) >= cap) return setNotice(t.errTooMany)

    const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
    const preview = kind === 'photo' ? URL.createObjectURL(file) : null
    setItems((prev) => [
      ...prev,
      { key, name: file.name, kind, bytes: file.size, preview, state: 'uploading' },
    ])

    const slot = await createUploadSlot({
      token: tokenRef.current || undefined,
      mime: file.type,
      bytes: file.size,
    })

    if (!slot.ok) {
      const msg =
        slot.error === 'type'
          ? t.errType
          : slot.error === 'size'
            ? t.errSize
            : slot.error === 'rateLimited'
              ? t.errTooMany
              : t.errServer
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, state: 'error', error: msg } : i))
      )
      return
    }

    if (!tokenRef.current) {
      tokenRef.current = slot.token
      setToken(slot.token)
    }

    try {
      const res = await fetch(slot.url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error(String(res.status))
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, state: 'done', path: slot.path } : i))
      )
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, state: 'error', error: t.errServer } : i))
      )
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setNotice(null)
    const files = [...(e.target.files ?? [])]
    if (inputRef.current) inputRef.current.value = ''
    for (const f of files) await upload(f)
  }

  async function remove(item: Item) {
    setItems((prev) => prev.filter((i) => i.key !== item.key))
    if (item.preview) URL.revokeObjectURL(item.preview)
    if (item.path && tokenRef.current) await discardDraftFile(tokenRef.current, item.path)
  }

  const uploading = items.some((i) => i.state === 'uploading')

  return (
    <div className="mt-6">
      {/* الرمز يسافر مع الاستمارة: به يجمع الخادم ملفّات هذه المسوّدة */}
      <input type="hidden" name="mediaToken" value={token} />
      {/* أسماء الملفّات كما سمّاها صاحبها — للعرض في الـBack-office فقط */}
      <input
        type="hidden"
        name="mediaNames"
        value={JSON.stringify(
          Object.fromEntries(
            items.filter((i) => i.path && i.state === 'done').map((i) => [i.path, i.name])
          )
        )}
      />
      {/* يمنع الإرسال ما دام ملفّ يُرفع — حتى لا تسبق الاستمارة صورها */}
      {uploading && <input type="hidden" name="mediaBusy" value="1" />}

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{t.title}</span>
        <span className="text-xs text-faint">{t.limits}</span>
      </div>
      <p className="mb-3 text-xs leading-6 text-muted">{t.hint}</p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_MEDIA_MIME.join(',')}
        onChange={onPick}
        className="block w-full cursor-pointer rounded border border-dashed border-line-strong bg-surface px-4 py-6 text-sm file:me-3 file:cursor-pointer file:rounded file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white"
        aria-label={t.pick}
      />

      {notice && (
        <p className="mt-3 rounded border border-[#e3c9c4] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8c2f22]">
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li
              key={i.key}
              className="flex items-center gap-3 rounded border border-line bg-surface p-3"
            >
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.preview}
                  alt=""
                  className="size-14 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded bg-surface-2 text-xs text-muted">
                  فيديو
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{i.name}</div>
                <div className="text-xs text-faint">
                  {humanBytes(i.bytes)} ·{' '}
                  {i.state === 'uploading' ? (
                    <span className="text-gold">{t.uploading}</span>
                  ) : i.state === 'done' ? (
                    <span className="text-brand">{t.done}</span>
                  ) : (
                    <span className="text-[#8c2f22]">{i.error}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-line-strong"
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs leading-6 text-faint">{t.private}</p>
    </div>
  )
}
