'use client'

import { useMemo, useState, useTransition } from 'react'
import { proposalText, type ClientProposal, type ProposalChannel } from '@/lib/client-proposal'
import { recordProposalAction } from '@/lib/actions/proposal'

export type ProposalSent = { id: number; channel: ProposalChannel; titles: string[]; created_at: string }

const CHANNEL_LABEL: Record<ProposalChannel, string> = {
  tracking: 'صفحة المتابعة',
  whatsapp: 'واتساب',
  copy: 'نسخ',
}

const H2 =
  "flex items-center gap-2 text-base font-semibold text-ink before:h-2.5 before:w-4 before:rounded-sm before:bg-gold-light before:content-['']"

/**
 * رسالة للحريف: نفس حلول الحوصلة بلغته، يختار منها المستشار ويبعث.
 *
 * النصّ يتولّد من الاختيار، ويبقى قابلاً للتعديل قبل الإرسال. التعديل اليدوي
 * لا يُمحى حين يتبدّل الاختيار — زرّ «رجّع النصّ المولَّد» يعيده عمداً.
 * الواتساب يُفتح برقم الحريف والنصّ جاهز؛ النشر يضع العناوين وحدها في صفحة
 * المتابعة. كلّ قناة تُسجَّل في سجلّ الملفّ.
 */
export default function ClientProposalPanel({
  requestId,
  proposal,
  waPhone,
  canEdit,
  history,
}: {
  requestId: string
  proposal: ClientProposal
  /** 216XXXXXXXX أو null إن لم يكن الرقم تونسياً صالحاً */
  waPhone: string | null
  canEdit: boolean
  history: ProposalSent[]
}) {
  const fr = proposal.locale === 'fr'
  const [selected, setSelected] = useState<string[]>(() => proposal.options.map((o) => o.key))
  const [draft, setDraft] = useState<string | null>(null)
  const [notify, setNotify] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const chosen = proposal.options.filter((o) => selected.includes(o.key))
  const generated = useMemo(() => proposalText(proposal, selected), [proposal, selected])
  const text = draft ?? generated
  const waText = draft ?? proposalText(proposal, selected, { whatsapp: true })
  const waHref = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}` : null

  const toggle = (key: string) =>
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))

  const record = (channel: ProposalChannel, done: string) => {
    if (!canEdit) {
      setStatus({ ok: true, text: done })
      return
    }
    start(async () => {
      const res = await recordProposalAction({
        requestId,
        keys: chosen.map((o) => o.key),
        titles: chosen.map((o) => o.title),
        message: text,
        channel,
        notifySms: channel === 'tracking' && notify,
      })
      setStatus(res.ok ? { ok: true, text: `${done} — تسجّل في سجلّ الملفّ.` } : { ok: false, text: res.error })
      if (res.ok && channel === 'tracking') setNotify(false)
    })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      record('copy', 'النصّ منسوخ')
    } catch {
      setStatus({ ok: false, text: 'المتصفّح منع النسخ — حدّد النصّ وانسخه يدوياً.' })
    }
  }

  return (
    <section id="sec-proposal" className="mt-4 scroll-mt-32 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={H2}>رسالة للحريف: حلول يمكن إرسالها</h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
          {fr ? 'بالفرنسية — لغة المطلب' : 'بالعربية — لغة المطلب'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted">
        نفس الحلول بلغة الحريف: بلا تنقيط ولا عبارات داخلية، وبلا وعود — أرقام تقديرية والقرار له والتمويل للبنك.
        اختر ما يناسب، راجع النصّ، ثمّ ابعث.
      </p>

      {proposal.options.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          معطيات الملفّ ما تكفيش باش تتولّد حلول بعد — كمّل الملفّ المالي والمواصفات أوّلاً.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <fieldset className="min-w-0">
              <legend className="flex w-full items-center justify-between gap-2 text-xs text-muted">
                <span>
                  الحلول المختارة: <b className="num text-ink">{chosen.length}</b> من{' '}
                  <span className="num">{proposal.options.length}</span>
                </span>
                <span className="flex gap-3">
                  <button type="button" className="text-brand hover:underline" onClick={() => setSelected(proposal.options.map((o) => o.key))}>
                    الكلّ
                  </button>
                  <button type="button" className="text-brand hover:underline" onClick={() => setSelected([])}>
                    لا شيء
                  </button>
                </span>
              </legend>
              <ul className="mt-2 space-y-2">
                {proposal.options.map((o) => {
                  const on = selected.includes(o.key)
                  return (
                    <li key={o.key}>
                      <label
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                          on ? 'border-brand/50 bg-brand-soft/50' : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(o.key)} className="mt-1 size-4 shrink-0 accent-brand" />
                        <span className="min-w-0" dir={fr ? 'ltr' : 'rtl'}>
                          <span className="block text-sm font-semibold text-ink">{o.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-6 text-muted">{o.text}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            <div className="min-w-0">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                  <span>النصّ كما يوصل للحريف — تنجّم تعدّله</span>
                  <span className="num">{[...text].length} حرف</span>
                </span>
                <textarea
                  value={text}
                  onChange={(e) => setDraft(e.target.value)}
                  dir={fr ? 'ltr' : 'rtl'}
                  rows={18}
                  className="w-full resize-y rounded-xl border border-line bg-ground p-3 text-sm leading-7 text-ink outline-none focus:border-brand focus:bg-surface"
                />
              </label>
              {draft !== null && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gold">
                  عدّلت النصّ يدوياً: تبديل الاختيار ما يبدّلوش.
                  <button type="button" onClick={() => setDraft(null)} className="font-medium text-brand hover:underline">
                    رجّع النصّ المولَّد
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {waHref ? (
              <a
                href={chosen.length ? waHref : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!chosen.length || pending}
                onClick={(e) => {
                  if (!chosen.length) {
                    e.preventDefault()
                    return
                  }
                  record('whatsapp', 'انفتح الواتساب بالنصّ')
                }}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition ${
                  chosen.length ? 'bg-[#1f8f4e] hover:bg-[#177240]' : 'cursor-not-allowed bg-[#1f8f4e]/40'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z" />
                </svg>
                ابعث بالواتساب
              </a>
            ) : (
              <span className="inline-flex h-10 items-center rounded-lg border border-dashed border-line px-3 text-xs text-muted">
                الواتساب غير متاح: رقم الحريف غير تونسي أو غير صالح — انسخ النصّ وابعثه يدوياً
              </span>
            )}

            <button
              type="button"
              onClick={copy}
              disabled={!chosen.length || pending}
              className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-brand transition hover:border-brand disabled:opacity-50"
            >
              انسخ النصّ
            </button>

            {canEdit && (
              <span className="ms-auto flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={notify}
                    onChange={(e) => setNotify(e.target.checked)}
                    disabled={!waPhone}
                    className="size-4 accent-brand"
                  />
                  أعلم الحريف برسالة قصيرة (تكلّف رسالة)
                </label>
                <button
                  type="button"
                  onClick={() => record('tracking', 'العناوين منشورة في صفحة المتابعة')}
                  disabled={!chosen.length || pending}
                  className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-50"
                >
                  انشر العناوين في صفحة المتابعة
                </button>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-6 text-faint">
            صفحة المتابعة تعرض عناوين الحلول وحدها، بلا أرقام ولا مبالغ — التفاصيل تمشي بالواتساب أو في المكالمة.
          </p>

          {status && (
            <p
              role="status"
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${status.ok ? 'bg-[#e6f0e9] text-[#1f6b3f]' : 'bg-[#fbeeeb] text-[#8c2f22]'}`}
            >
              {pending ? '…' : status.text}
            </p>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-xs font-semibold text-muted">آخر ما أُرسل</div>
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-2">
                <span className="num text-faint">{new Date(h.created_at).toLocaleString('fr-TN')}</span>
                <span className="rounded bg-surface-2 px-1.5 text-muted">{CHANNEL_LABEL[h.channel] ?? h.channel}</span>
                <span>{h.titles.join('، ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
