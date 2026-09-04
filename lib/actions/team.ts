'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { logStaffEvent, staffWithPermission, type StaffMember } from '@/lib/auth'
import { canManageRole, isRole, type Role } from '@/lib/permissions'

export type TeamState = { error?: string; ok?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type TargetRow = {
  user_id: string
  email: string | null
  full_name: string | null
  role: Role
  active: boolean
}

/** يجلب العضو الهدف ويتحقّق من أنّ الفاعل مخوَّل للتصرّف فيه. */
async function loadTarget(
  actor: StaffMember,
  userId: string
): Promise<{ target?: TargetRow; error?: string }> {
  const { data } = await db
    .from('staff')
    .select('user_id, email, full_name, role, active')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data || !isRole(data.role)) return { error: 'العضو غير موجود.' }
  if (data.user_id === actor.userId) return { error: 'لا يمكنك التصرّف في حسابك من هنا.' }
  if (!canManageRole(actor.role, data.role))
    return { error: 'دورك لا يخوّل لك التصرّف في هذا العضو.' }

  return { target: data as TargetRow }
}

/** يمنع ترك اللوحة بلا مالك نشط. */
async function isLastActiveOwner(userId: string): Promise<boolean> {
  const { data } = await db.from('staff').select('user_id').eq('role', 'owner').eq('active', true)
  const owners = data ?? []
  return owners.length <= 1 && owners.some((o) => o.user_id === userId)
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

export async function createMemberAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await staffWithPermission('team.manage_members')
  if (!actor) return { error: 'غير مصرّح.' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const role = String(formData.get('role') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!EMAIL_RE.test(email)) return { error: 'البريد الإلكتروني غير صالح.' }
  if (fullName.length < 2) return { error: 'أدخل الاسم الكامل.' }
  if (!isRole(role)) return { error: 'الدور غير صالح.' }
  if (!canManageRole(actor.role, role)) return { error: 'دورك لا يخوّل لك إسناد هذا الدور.' }
  if (password.length < 8) return { error: 'كلمة السرّ المؤقّتة: 8 أحرف على الأقلّ.' }

  const { data: existingStaff } = await db
    .from('staff')
    .select('user_id')
    .ilike('email', email)
    .maybeSingle()
  if (existingStaff) return { error: 'هذا البريد مسجّل في الفريق بالفعل.' }

  let userId: string
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (created?.user) {
    userId = created.user.id
  } else {
    // الحساب موجود في Supabase Auth دون سطر في staff (عضو أُزيل سابقاً مثلاً).
    const existing = await findAuthUserByEmail(email)
    if (!existing) {
      return { error: 'تعذّر إنشاء الحساب: ' + (createError?.message ?? 'سبب غير معروف') }
    }
    const { error } = await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (error) return { error: 'تعذّر ضبط كلمة السرّ: ' + error.message }
    userId = existing.id
  }

  const { error } = await db.from('staff').upsert(
    {
      user_id: userId,
      email,
      full_name: fullName,
      role,
      active: true,
      must_change_password: true,
      created_by: actor.userId,
    },
    { onConflict: 'user_id' }
  )
  if (error) return { error: 'تعذّر إضافة العضو: ' + error.message }

  await logStaffEvent({
    eventType: 'member_created',
    actor: actor.userId,
    actorEmail: actor.email,
    target: userId,
    targetEmail: email,
    detail: { role, full_name: fullName },
  })

  revalidatePath('/admin/team')
  return { ok: 'أُضيف ' + fullName + ' إلى الفريق. سلّمه كلمة السرّ المؤقّتة ليغيّرها عند أوّل دخول.' }
}

export async function setRoleAction(formData: FormData) {
  const actor = await staffWithPermission('team.manage_members')
  if (!actor) return

  const userId = String(formData.get('user_id') ?? '')
  const role = String(formData.get('role') ?? '')
  if (!isRole(role)) return

  const { target } = await loadTarget(actor, userId)
  if (!target) return
  if (!canManageRole(actor.role, role)) return
  if (target.role === role) return
  if (target.role === 'owner' && (await isLastActiveOwner(userId))) return

  await db.from('staff').update({ role }).eq('user_id', userId)
  await logStaffEvent({
    eventType: 'role_changed',
    actor: actor.userId,
    actorEmail: actor.email,
    target: userId,
    targetEmail: target.email,
    detail: { from: target.role, to: role },
  })

  revalidatePath('/admin/team')
}

export async function setActiveAction(formData: FormData) {
  const actor = await staffWithPermission('team.manage_members')
  if (!actor) return

  const userId = String(formData.get('user_id') ?? '')
  const active = String(formData.get('active') ?? '') === 'true'

  const { target } = await loadTarget(actor, userId)
  if (!target) return
  if (!active && (await isLastActiveOwner(userId))) return

  await db.from('staff').update({ active }).eq('user_id', userId)
  await logStaffEvent({
    eventType: active ? 'activated' : 'deactivated',
    actor: actor.userId,
    actorEmail: actor.email,
    target: userId,
    targetEmail: target.email,
  })

  revalidatePath('/admin/team')
}

export async function setPasswordAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await staffWithPermission('team.manage_members')
  if (!actor) return { error: 'غير مصرّح.' }

  const userId = String(formData.get('user_id') ?? '')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) return { error: 'كلمة السرّ المؤقّتة: 8 أحرف على الأقلّ.' }

  const { target, error: guard } = await loadTarget(actor, userId)
  if (!target) return { error: guard }

  const { error } = await db.auth.admin.updateUserById(userId, { password })
  if (error) return { error: 'تعذّر ضبط كلمة السرّ: ' + error.message }

  await db.from('staff').update({ must_change_password: true }).eq('user_id', userId)
  await logStaffEvent({
    eventType: 'password_set',
    actor: actor.userId,
    actorEmail: actor.email,
    target: userId,
    targetEmail: target.email,
  })

  revalidatePath('/admin/team')
  return { ok: 'ضُبطت كلمة سرّ مؤقّتة لـ ' + (target.full_name ?? target.email ?? '') + '.' }
}

/**
 * يسحب النفاذ نهائياً بحذف سطر الفريق. حساب Supabase Auth يبقى قائماً عمداً:
 * أعمدة actor في سجلّ الأثر تشير إليه، وحذفه يفقدنا نسبة العمليات إلى أصحابها.
 */
export async function removeMemberAction(formData: FormData) {
  const actor = await staffWithPermission('team.manage_members')
  if (!actor) return

  const userId = String(formData.get('user_id') ?? '')
  const { target } = await loadTarget(actor, userId)
  if (!target) return
  if (await isLastActiveOwner(userId)) return

  await db.from('staff').delete().eq('user_id', userId)
  await logStaffEvent({
    eventType: 'member_removed',
    actor: actor.userId,
    actorEmail: actor.email,
    target: userId,
    targetEmail: target.email,
    detail: { role: target.role },
  })

  revalidatePath('/admin/team')
}
