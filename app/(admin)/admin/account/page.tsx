import { requireSession } from '@/lib/auth'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions'
import { NameForm, PasswordForm } from '@/components/AccountForms'

export const metadata = { title: 'حسابي — لوحة القيادة' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const staff = await requireSession()

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="display text-2xl font-semibold">حسابي</h1>
      <p className="mt-1 text-sm text-muted" dir="ltr">
        {staff.email}
      </p>

      <div className="mt-6 rounded border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">الدور:</span>
          <span className="rounded-full bg-green-soft px-2.5 py-0.5 text-xs text-green">
            {ROLE_LABELS[staff.role]}
          </span>
        </div>
        <p className="mt-2 text-sm leading-7 text-muted">{ROLE_DESCRIPTIONS[staff.role]}</p>
        {staff.lastLoginAt && (
          <p className="mt-2 text-xs text-faint">
            آخر دخول: {new Date(staff.lastLoginAt).toLocaleString('ar-TN')}
          </p>
        )}
      </div>

      <div className="mt-4 rounded border border-line bg-surface p-5">
        <h2 className="text-base font-medium">الاسم</h2>
        <div className="mt-4">
          <NameForm fullName={staff.fullName} />
        </div>
      </div>

      <div className="mt-4 rounded border border-line bg-surface p-5">
        <h2 className="text-base font-medium">كلمة السرّ</h2>
        {staff.mustChangePassword && (
          <p className="mt-2 rounded border border-[#e8dcc2] bg-bronze-soft px-3 py-2 text-sm text-bronze">
            كلمة سرّك مؤقّتة ضبطها لك مدير اللوحة. غيّرها الآن.
          </p>
        )}
        <div className="mt-4">
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}
