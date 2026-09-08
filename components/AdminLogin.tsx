'use client'

import { useActionState } from 'react'
import { loginAction, type FormState } from '@/lib/actions/auth'

export default function AdminLogin({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, {} as FormState)

  return (
    <div className="mx-auto max-w-sm px-5 py-24">
      <div className="rounded border border-line bg-surface p-5 sm:p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h1 className="display text-xl font-semibold">لوحة القيادة</h1>
        <p className="mt-2 text-sm text-muted">فضاء فريق اللَّبنة.</p>

        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ''} />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">البريد الإلكتروني</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              autoFocus
              required
              dir="ltr"
              className="w-full rounded border border-line px-3.5 py-2.5 text-left outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">كلمة السرّ</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              dir="ltr"
              className="w-full rounded border border-line px-3.5 py-2.5 text-left outline-none focus:border-brand"
            />
          </label>

          {state?.error && (
            <p className="rounded border border-[#e3c9c4] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8c2f22]">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-brand px-5 py-3 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? 'جاري التحقّق…' : 'دخول'}
          </button>
        </form>

        <p className="mt-6 border-t border-line pt-4 text-xs leading-6 text-faint">
          النفاذ محصور في أعضاء الفريق. إن نسيت كلمة السرّ، اطلب من مالك اللوحة ضبط كلمة سرّ
          مؤقّتة جديدة.
        </p>
      </div>
    </div>
  )
}
