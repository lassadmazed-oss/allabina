'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { initialGateState, type GateState } from '@/lib/gate-state'
import { requestCodeAction, verifyCodeAction } from '@/lib/actions/account'
import type { Dictionary, Locale } from '@/lib/i18n'

type T = Dictionary['account']

/**
 * بوّابة الحساب — شاشتان.
 *
 * الطريق الأقصر هو الذي لا يمرّ بقوقل ولا فيسبوك: هما يعطيان بريداً،
 * والخدمة كلّها على التليفون، فبعدهما يبقى الرقم مطلوباً والتحقّق
 * مطلوباً. رقم ← رمز ← خلاص.
 *
 * وأثقل خطوة ليست الكتابة بل الخروج: يفتح الرسائل، يحفظ ستّة أعداد،
 * يرجع. فـWebOTP يقرأها من الرسالة ويعمّرها ويرسل — ولا يُعرض له شيء
 * يفعله. وحيث لا يوجد (آيفون، متصفّح قديم) تبقى الخانة عادية بـ
 * autocomplete="one-time-code"، فلوحة المفاتيح تقترح الرمز.
 */
export default function PhoneGate({
  locale,
  t,
  next,
}: {
  locale: Locale
  t: T
  next?: string
}) {
  const [state, action, pending] = useActionState<GateState, FormData>(
    requestCodeAction,
    initialGateState
  )
  return state.step === 'phone' ? (
    <PhoneStep locale={locale} t={t} state={state} action={action} pending={pending} />
  ) : (
    <CodeStep locale={locale} t={t} first={state} next={next} />
  )
}

function Problem({ t, state }: { t: T; state: GateState }) {
  if (!state.error) return null
  const msg = t.errors[state.error as keyof T['errors']] ?? t.errors.failed
  return (
    <p role="alert" className="mt-2 text-sm font-medium text-[#a32a24] dark:text-[#f08b84]">
      {msg}
    </p>
  )
}

function PhoneStep({
  locale,
  t,
  state,
  action,
  pending,
}: {
  locale: Locale
  t: T
  state: GateState
  action: (f: FormData) => void
  pending: boolean
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.phoneLabel}</span>
        <input
          id="gate-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus
          dir="ltr"
          placeholder={t.phonePlaceholder}
          defaultValue={state.phone}
          className="num w-full rounded border border-line bg-surface px-3 py-3 text-lg tracking-wide"
        />
      </label>

      {/* السؤال الذي في رأسه: علاش رقمي؟ — الجواب قبل أن يسأل */}
      <p className="text-sm leading-7 text-muted">
        {t.why} <span className="text-faint">{t.whyMore}</span>
      </p>

      <Problem t={t} state={state} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-brand px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t.sending : t.send}
      </button>
    </form>
  )
}

function CodeStep({
  locale,
  t,
  first,
  next,
}: {
  locale: Locale
  t: T
  first: GateState
  next?: string
}) {
  const [state, action, pending] = useActionState<GateState, FormData>(verifyCodeAction, first)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [left, setLeft] = useState(first.retryAfter ?? 0)

  // عدّاد إعادة الإرسال: كلّ رمز رسالة مدفوعة
  useEffect(() => {
    if (left <= 0) return
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [left])

  // WebOTP: يقرأ الرمز من الرسالة، يعمّره، ويرسل. يُلغى عند مغادرة
  // الشاشة وإلّا بقي الطلب معلّقاً يمسك الرسالة التالية.
  useEffect(() => {
    const api = (navigator as Navigator & { credentials?: CredentialsContainer }).credentials
    if (!api || !('OTPCredential' in window)) return
    const ac = new AbortController()
    api
      .get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as (Credential & { code?: string }) | null)?.code
        if (!code || !inputRef.current) return
        inputRef.current.value = code
        formRef.current?.requestSubmit()
      })
      .catch(() => {
        /* رُفض أو أُلغي — الخانة تبقى يدويّة */
      })
    return () => ac.abort()
  }, [])

  const phone = state.phone || first.phone

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {t.codeSent} <span className="num font-semibold text-ink">{phone}</span>
      </p>

      {(state.notSent ?? first.notSent) && (
        <p className="rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
          {t.notSent}
        </p>
      )}

      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={next ?? ''} />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t.codeLabel}</span>
          <input
            ref={inputRef}
            id="gate-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            dir="ltr"
            className="num w-full rounded border border-line bg-surface px-3 py-3 text-center text-2xl tracking-[0.4em]"
          />
          <span className="mt-1.5 block text-xs text-faint">{t.codeHelp}</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t.nameLabel}</span>
          <input
            id="gate-name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            className="w-full rounded border border-line bg-surface px-3 py-2.5"
          />
        </label>

        <Problem t={t} state={state} />

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-brand px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? t.verifying : t.verify}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <a href={`/${locale}/compte`} className="text-muted underline underline-offset-4">
          {t.change}
        </a>
        <ResendButton locale={locale} t={t} phone={phone} left={left} onSent={setLeft} />
      </div>
    </div>
  )
}

function ResendButton({
  locale,
  t,
  phone,
  left,
  onSent,
}: {
  locale: Locale
  t: T
  phone: string
  left: number
  onSent: (n: number) => void
}) {
  const [state, action, pending] = useActionState<GateState, FormData>(
    requestCodeAction,
    initialGateState
  )

  useEffect(() => {
    if (state.retryAfter) onSent(state.retryAfter)
  }, [state, onSent])

  if (left > 0) {
    return (
      <span className="text-faint">
        {t.resendIn} <span className="num">{left}</span> {t.seconds}
      </span>
    )
  }
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phone" value={phone} />
      <button type="submit" disabled={pending} className="text-brand underline underline-offset-4">
        {pending ? t.sending : t.resend}
      </button>
    </form>
  )
}
