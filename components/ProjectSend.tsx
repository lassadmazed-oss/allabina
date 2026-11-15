'use client'

import { useActionState } from 'react'
import { sendProjectCodeAction, submitProjectAction, type SendState } from '@/lib/actions/project'
import type { Dictionary, Locale } from '@/lib/i18n'
import Icon from '@/components/Icon'

/**
 * «ابعث للدراسة» — الخطوة الرابعة (الماكيتة F03).
 *
 * قرار 15/11/2026: لا حاجز قبل الرسم ولا قبل التقدير. الحريف يشوف
 * ويختار، وفي آخر مرحلة يعطي اسمه ورقمه ويبعث — فالرسالة لا تُدفع
 * إلّا عند مطلبٍ حقيقي، والحاجز في النصّ يخسر من لم يرَ بعدُ قيمةً.
 *
 * والرقم يبقى متثبَّتاً: رمزٌ يُطلب ويُفحص في نفس الخطوة. انتقل موضع
 * التثبّت ولم يسقط.
 */
const initial: SendState = { step: 'form', phone: '', fullName: '' }

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-faint'

export default function ProjectSend({
  locale,
  t,
  account,
  specs,
}: {
  locale: Locale
  t: Dictionary['account']
  /** مواصفات المشروع — تُمرَّر حقولاً مخفيّة حتّى تصل مع البعث */
  specs: Record<string, string>
  account: Dictionary['projet']
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(
    sendProjectCodeAction,
    initial
  )

  return state.step === 'form' ? (
    <Form
      locale={locale}
      t={t}
      account={account}
      specs={specs}
      state={state}
      action={action}
      pending={pending}
    />
  ) : (
    <CodeForm locale={locale} t={t} account={account} specs={specs} first={state} />
  )
}

function Problem({ t, state }: { t: Dictionary['account']; state: SendState }) {
  if (!state.error) return null
  const msg = t.errors[state.error as keyof typeof t.errors] ?? t.errors.failed
  return (
    <p
      role="alert"
      className="mt-3 flex items-start gap-2 rounded-lg bg-[#fdeaea] px-3 py-2 text-sm leading-6 text-[#8a2020]"
    >
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </p>
  )
}

function Hidden({ specs }: { specs: Record<string, string> }) {
  return (
    <>
      {Object.entries(specs).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  )
}

function Form({
  locale,
  t,
  account,
  specs,
  state,
  action,
  pending,
}: {
  locale: Locale
  t: Dictionary['account']
  account: Dictionary['projet']
  specs: Record<string, string>
  state: SendState
  action: (f: FormData) => void
  pending: boolean
}) {
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <Hidden specs={specs} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.nameLabel}</span>
        <input
          name="full_name"
          defaultValue={state.fullName}
          required
          autoComplete="name"
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.phoneLabel}</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          defaultValue={state.phone}
          required
          autoComplete="tel"
          placeholder={t.phonePlaceholder}
          className={`num ${field}`}
        />
      </label>

      <Problem t={t} state={state} />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        <Icon name="send" className="h-[18px] w-[18px]" />
        {pending ? t.sending : account.sendStudy}
      </button>
      <p className="text-xs leading-6 text-faint">{account.sendWhy}</p>
    </form>
  )
}

function CodeForm({
  locale,
  t,
  account,
  specs,
  first,
}: {
  locale: Locale
  t: Dictionary['account']
  account: Dictionary['projet']
  specs: Record<string, string>
  first: SendState
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(submitProjectAction, first)

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phone" value={first.phone} />
      <input type="hidden" name="full_name" value={first.fullName} />
      <Hidden specs={specs} />

      <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm leading-6 text-brand">
        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {first.notSent ? t.notSent : t.codeSent}{' '}
          <span className="num" dir="ltr">
            {first.phone}
          </span>
        </span>
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.codeLabel}</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          required
          className={`num ${field} tracking-[0.4em]`}
        />
      </label>

      <Problem t={t} state={state} />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        <Icon name="send" className="h-[18px] w-[18px]" />
        {pending ? t.sending : account.sendConfirm}
      </button>
    </form>
  )
}
