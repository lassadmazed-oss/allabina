'use client'

import { useActionState } from 'react'
import { changePasswordAction, updateOwnNameAction, type FormState } from '@/lib/actions/auth'

const field =
  'w-full rounded border border-line px-3.5 py-2.5 outline-none focus:border-green'
const button =
  'rounded bg-green px-5 py-2.5 font-medium text-white transition hover:bg-green-deep disabled:opacity-60'

function Feedback({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p className="rounded border border-[#e3c9c4] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8c2f22]">
        {state.error}
      </p>
    )
  if (state?.ok)
    return (
      <p className="rounded border border-line bg-green-soft px-3 py-2 text-sm text-green">
        {state.ok}
      </p>
    )
  return null
}

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(updateOwnNameAction, {} as FormState)

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">الاسم الكامل</span>
        <input name="full_name" defaultValue={fullName} required className={field} />
      </label>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? 'جاري الحفظ…' : 'حفظ'}
      </button>
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {} as FormState)

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">كلمة السرّ الحالية</span>
        <input
          type="password"
          name="current"
          autoComplete="current-password"
          required
          dir="ltr"
          className={`${field} text-left`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">كلمة السرّ الجديدة</span>
        <input
          type="password"
          name="next"
          autoComplete="new-password"
          minLength={8}
          required
          dir="ltr"
          className={`${field} text-left`}
        />
        <span className="mt-1 block text-xs text-faint">8 أحرف على الأقلّ.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">تأكيد كلمة السرّ الجديدة</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
          dir="ltr"
          className={`${field} text-left`}
        />
      </label>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? 'جاري التغيير…' : 'تغيير كلمة السرّ'}
      </button>
    </form>
  )
}
