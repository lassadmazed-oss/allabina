import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/session'
import { db } from '@/lib/supabase/server'
import { can, isRole, type Permission, type Role } from '@/lib/permissions'

export type StaffMember = {
  userId: string
  email: string
  fullName: string
  role: Role
  mustChangePassword: boolean
  lastLoginAt: string | null
}

export type StaffEventType =
  | 'login'
  | 'login_failed'
  | 'login_denied'
  | 'logout'
  | 'member_created'
  | 'role_changed'
  | 'activated'
  | 'deactivated'
  | 'password_set'
  | 'password_changed'
  | 'member_removed'

/** سجلّ التدقيق. لا يرمي أبداً: فشل التسجيل لا يوقف العملية الأصلية. */
export async function logStaffEvent(entry: {
  eventType: StaffEventType
  actor?: string | null
  actorEmail?: string | null
  target?: string | null
  targetEmail?: string | null
  detail?: Record<string, unknown>
}): Promise<void> {
  const { error } = await db.from('staff_events').insert({
    event_type: entry.eventType,
    actor: entry.actor ?? null,
    actor_email: entry.actorEmail ?? null,
    target: entry.target ?? null,
    target_email: entry.targetEmail ?? null,
    detail: entry.detail ?? null,
  })
  if (error) console.error('staff_events', error.message)
}

/**
 * عضو الفريق الحالي، أو null إن لم تكن هناك جلسة أو كان الحساب معطّلاً.
 * ملفوفة بـ cache حتى لا تتكرّر الاستعلامات في نفس الطلب.
 */
export const getCurrentStaff = cache(async (): Promise<StaffMember | null> => {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('staff')
    .select('user_id, email, full_name, role, active, must_change_password, last_login_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data || !data.active || !isRole(data.role)) return null

  return {
    userId: data.user_id,
    email: data.email ?? user.email ?? '',
    fullName: data.full_name ?? data.email ?? user.email ?? '',
    role: data.role,
    mustChangePassword: Boolean(data.must_change_password),
    lastLoginAt: data.last_login_at ?? null,
  }
})

/** يفرض جلسة صالحة. يوجّه إلى تغيير كلمة السرّ إن كانت مؤقّتة. */
export async function requireStaff(): Promise<StaffMember> {
  const staff = await getCurrentStaff()
  if (!staff) redirect('/admin/login')
  if (staff.mustChangePassword) redirect('/admin/account')
  return staff
}

/** مثل requireStaff لكن دون تحويل إلى صفحة الحساب — تستعملها صفحة الحساب نفسها. */
export async function requireSession(): Promise<StaffMember> {
  const staff = await getCurrentStaff()
  if (!staff) redirect('/admin/login')
  return staff
}

/** يفرض صلاحية بعينها. عند غيابها: تحويل إلى جذر اللوحة. */
export async function requirePermission(permission: Permission): Promise<StaffMember> {
  const staff = await requireStaff()
  if (!can(staff.role, permission)) redirect('/admin')
  return staff
}

/** للأفعال والمسارات: يعيد null بدل التحويل حتى يتحكّم المستدعي في الردّ. */
export async function staffWithPermission(permission: Permission): Promise<StaffMember | null> {
  const staff = await getCurrentStaff()
  if (!staff || staff.mustChangePassword || !can(staff.role, permission)) return null
  return staff
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    await logStaffEvent({ eventType: 'login_failed', actorEmail: email })
    return { error: 'البريد الإلكتروني أو كلمة السرّ غير صحيحة.' }
  }

  const { data: row } = await db
    .from('staff')
    .select('user_id, active, role')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!row || !row.active) {
    await supabase.auth.signOut()
    await logStaffEvent({
      eventType: 'login_denied',
      actor: data.user.id,
      actorEmail: email,
      detail: { reason: row ? 'حساب معطّل' : 'ليس من الفريق' },
    })
    return { error: 'هذا الحساب غير مخوَّل للنفاذ إلى لوحة القيادة.' }
  }

  await db
    .from('staff')
    .update({ last_login_at: new Date().toISOString(), email: data.user.email })
    .eq('user_id', data.user.id)

  await logStaffEvent({ eventType: 'login', actor: data.user.id, actorEmail: data.user.email })
  return {}
}

export async function signOutUser(): Promise<void> {
  const staff = await getCurrentStaff()
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  if (staff) {
    await logStaffEvent({ eventType: 'logout', actor: staff.userId, actorEmail: staff.email })
  }
}

/** تغيير كلمة السرّ الشخصية بعد التثبّت من الحالية. */
export async function changeOwnPassword(
  current: string,
  next: string
): Promise<{ error?: string }> {
  const staff = await getCurrentStaff()
  if (!staff) return { error: 'انتهت الجلسة، أعد الدخول.' }
  if (next.length < 8) return { error: 'كلمة السرّ الجديدة: 8 أحرف على الأقلّ.' }
  if (next === current) return { error: 'كلمة السرّ الجديدة مطابقة للحالية.' }

  const supabase = await createServerSupabase()
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: staff.email,
    password: current,
  })
  if (reauth) return { error: 'كلمة السرّ الحالية غير صحيحة.' }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { error: 'تعذّر تغيير كلمة السرّ: ' + error.message }

  await db
    .from('staff')
    .update({ must_change_password: false })
    .eq('user_id', staff.userId)

  await logStaffEvent({
    eventType: 'password_changed',
    actor: staff.userId,
    actorEmail: staff.email,
  })
  return {}
}
