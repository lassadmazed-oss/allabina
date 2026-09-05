'use client'

import { useActionState, useState } from 'react'
import { createMemberAction, setPasswordAction, type TeamState } from '@/lib/actions/team'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/lib/permissions'

const field = 'w-full rounded border border-line px-3.5 py-2.5 outline-none focus:border-brand'
const button =
  'rounded bg-brand px-5 py-2.5 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60'

function Feedback({ state }: { state: TeamState }) {
  if (state?.error)
    return (
      <p className="rounded border border-[#e3c9c4] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8c2f22]">
        {state.error}
      </p>
    )
  if (state?.ok)
    return (
      <p className="rounded border border-line bg-brand-soft px-3 py-2 text-sm text-brand">
        {state.ok}
      </p>
    )
  return null
}

export function AddMemberForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(createMemberAction, {} as TeamState)
  const [role, setRole] = useState<Role>(roles[roles.length - 1] ?? 'viewer')

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">الاسم الكامل</span>
        <input name="full_name" required className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">البريد الإلكتروني</span>
        <input type="email" name="email" required dir="ltr" className={`${field} text-left`} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">الدور</span>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={field}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs leading-6 text-faint">{ROLE_DESCRIPTIONS[role]}</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">كلمة سرّ مؤقّتة</span>
        <input
          type="password"
          name="password"
          minLength={8}
          required
          dir="ltr"
          autoComplete="new-password"
          className={`${field} text-left`}
        />
        <span className="mt-1 block text-xs text-faint">
          8 أحرف على الأقلّ. يُطلب من العضو تغييرها عند أوّل دخول.
        </span>
      </label>

      <div className="sm:col-span-2">
        <Feedback state={state} />
      </div>

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={button}>
          {pending ? 'جاري الإضافة…' : 'إضافة العضو'}
        </button>
      </div>
    </form>
  )
}

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(setPasswordAction, {} as TeamState)

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-line-strong"
      >
        كلمة سرّ جديدة
      </button>
    )

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input
        type="password"
        name="password"
        minLength={8}
        required
        dir="ltr"
        autoComplete="new-password"
        placeholder={`كلمة سرّ لـ ${name}`}
        className="w-44 rounded border border-line px-2.5 py-1 text-left text-xs outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-brand px-2.5 py-1 text-xs text-white disabled:opacity-60"
      >
        {pending ? '…' : 'ضبط'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-faint hover:text-muted"
      >
        إلغاء
      </button>
      {(state?.error || state?.ok) && (
        <span className={`text-xs ${state.error ? 'text-[#8c2f22]' : 'text-brand'}`}>
          {state.error ?? state.ok}
        </span>
      )}
    </form>
  )
}
