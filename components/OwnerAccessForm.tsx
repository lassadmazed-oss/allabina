'use client'

import { useActionState } from 'react'
import { openOwnerSession, type OpenState } from '@/lib/actions/request-edit'
import type { Dictionary, Locale } from '@/lib/i18n'

const initial: OpenState = {}

/**
 * باب التعديل: الرمز + الهاتف مرّة واحدة، ثمّ كوكي قصير.
 *
 * استمارة مستقلّة عن استمارة الاطّلاع فوقها لأنّها POST لا GET —
 * ما نحبّوش رقم الهاتف يتسجّل في تاريخ المتصفّح ولا في سجلّ الخادم
 * لمجرّد أنّ صاحبه حبّ يصلّح دخله.
 */
export default function OwnerAccessForm({
  locale,
  t,
  defaultRef = '',
}: {
  locale: Locale
  t: Dictionary['suivi']
  defaultRef?: string
}) {
  const [state, formAction, pending] = useActionState(openOwnerSession, initial)

  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="locale" value={locale} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.refCode}</span>
        <input
          name="ref"
          defaultValue={defaultRef}
          dir="ltr"
          required
          placeholder="LB-2026-000001"
          className="num w-full rounded border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.phone}</span>
        <input
          name="phone"
          dir="ltr"
          required
          inputMode="tel"
          placeholder="20123456"
          className="num w-full rounded border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-brand"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded bg-brand px-6 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:self-end"
      >
        {pending ? t.edit.opening : t.edit.open}
      </button>

      {state.error && (
        <p
          role="alert"
          className="rounded border border-[#e0b4ac] bg-[#fbeeeb] px-4 py-3 text-sm leading-7 text-[#8c2f22] sm:col-span-3"
        >
          {t.edit.errors[state.error]}
        </p>
      )}
    </form>
  )
}
