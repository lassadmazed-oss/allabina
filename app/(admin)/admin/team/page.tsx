import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  ROLE_LABELS,
  assignableRoles,
  canManageRole,
  isRole,
  type Role,
} from '@/lib/permissions'
import { removeMemberAction, setActiveAction, setRoleAction } from '@/lib/actions/team'
import { AddMemberForm, ResetPasswordForm } from '@/components/TeamPanel'

export const metadata = { title: 'الفريق — لوحة القيادة' }
export const dynamic = 'force-dynamic'

type StaffRow = {
  user_id: string
  email: string | null
  full_name: string | null
  role: string
  active: boolean
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
}

type EventRow = {
  id: number
  event_type: string
  actor_email: string | null
  target_email: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  login: 'دخول',
  login_failed: 'محاولة دخول فاشلة',
  login_denied: 'دخول مرفوض',
  logout: 'خروج',
  member_created: 'إضافة عضو',
  role_changed: 'تغيير دور',
  activated: 'تفعيل حساب',
  deactivated: 'تعطيل حساب',
  password_set: 'ضبط كلمة سرّ مؤقّتة',
  password_changed: 'تغيير كلمة سرّ',
  member_removed: 'إزالة عضو',
}

const dt = (v: string | null) =>
  v ? new Date(v).toLocaleString('ar-TN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default async function TeamPage() {
  const me = await requirePermission('team.read')

  const [{ data: staffRaw }, { data: eventsRaw }] = await Promise.all([
    db
      .from('staff')
      .select('user_id, email, full_name, role, active, must_change_password, last_login_at, created_at')
      .order('active', { ascending: false })
      .order('created_at'),
    db
      .from('staff_events')
      .select('id, event_type, actor_email, target_email, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const members = (staffRaw ?? []) as StaffRow[]
  const events = (eventsRaw ?? []) as EventRow[]
  const roles = assignableRoles(me.role)

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="display text-2xl font-semibold">الفريق</h1>
      <p className="mt-1 text-sm text-muted">
        {members.filter((m) => m.active).length} عضو نشط من جملة {members.length}
      </p>

      {/* ---- الأعضاء ---- */}
      <div className="mt-8 overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-surface-2 text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">العضو</th>
              <th className="px-4 py-3 font-medium">الدور</th>
              <th className="px-4 py-3 font-medium">آخر دخول</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const role: Role = isRole(m.role) ? m.role : 'viewer'
              const isMe = m.user_id === me.userId
              const editable = !isMe && canManageRole(me.role, role)

              return (
                <tr key={m.user_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {m.full_name ?? '—'}
                      {isMe && <span className="mr-2 text-xs text-faint">(أنت)</span>}
                    </div>
                    <div className="text-xs text-faint" dir="ltr">
                      {m.email ?? '—'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {editable && roles.length > 0 ? (
                      <form action={setRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <select
                          name="role"
                          defaultValue={role}
                          className="rounded border border-line px-2 py-1 text-xs outline-none focus:border-brand"
                        >
                          {[...new Set([...roles, role])].map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-line-strong">
                          حفظ
                        </button>
                      </form>
                    ) : (
                      <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand">
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-muted">{dt(m.last_login_at)}</td>

                  <td className="px-4 py-3">
                    {m.active ? (
                      <span className="text-brand">نشط</span>
                    ) : (
                      <span className="text-faint">معطّل</span>
                    )}
                    {m.must_change_password && (
                      <div className="text-xs text-gold">كلمة سرّ مؤقّتة</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {editable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ResetPasswordForm userId={m.user_id} name={m.full_name ?? ''} />
                        <form action={setActiveAction}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <input type="hidden" name="active" value={m.active ? 'false' : 'true'} />
                          <button className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-line-strong">
                            {m.active ? 'تعطيل' : 'تفعيل'}
                          </button>
                        </form>
                        <form action={removeMemberAction}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <button className="rounded border border-line px-2.5 py-1 text-xs text-[#8c2f22] transition hover:border-[#e3c9c4]">
                            إزالة
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ---- إضافة عضو ---- */}
      {roles.length > 0 && (
        <div className="mt-4 rounded border border-line bg-surface p-5">
          <h2 className="text-base font-medium">إضافة عضو</h2>
          <p className="mt-1 text-sm text-muted">
            يُنشأ الحساب فوراً بكلمة سرّ مؤقّتة تسلّمها للعضو مباشرة — لا تُرسل أيّ رسالة بريد.
          </p>
          <div className="mt-5">
            <AddMemberForm roles={roles} />
          </div>
        </div>
      )}

      {/* ---- سجلّ التدقيق ---- */}
      <div className="mt-4 rounded border border-line bg-surface p-5">
        <h2 className="text-base font-medium">سجلّ النفاذ</h2>
        <p className="mt-1 text-sm text-muted">آخر {events.length} عملية.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2 last:border-0">
              <span className="w-36 shrink-0 text-xs text-faint num">{dt(e.created_at)}</span>
              <span className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
              <span className="text-muted" dir="ltr">
                {e.actor_email ?? '—'}
              </span>
              {e.target_email && e.target_email !== e.actor_email && (
                <span className="text-faint" dir="ltr">
                  ← {e.target_email}
                </span>
              )}
              {e.detail && e.detail.from != null && e.detail.to != null && (
                <span className="text-xs text-faint">
                  {String(e.detail.from)} ← {String(e.detail.to)}
                </span>
              )}
            </li>
          ))}
          {events.length === 0 && <li className="text-muted">لا شيء بعد.</li>}
        </ul>
      </div>
    </div>
  )
}
