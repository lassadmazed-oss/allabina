'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  changeOwnPassword,
  getCurrentStaff,
  requireSession,
  signInWithPassword,
  signOutUser,
} from '@/lib/auth'
import { db } from '@/lib/supabase/server'

export type FormState = { error?: string; ok?: string }

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  if (!email || !password) return { error: 'أدخل البريد الإلكتروني وكلمة السرّ.' }

  const { error } = await signInWithPassword(email, password)
  if (error) return { error }

  const staff = await getCurrentStaff()
  revalidatePath('/admin', 'layout')
  redirect(staff?.mustChangePassword ? '/admin/account' : next.startsWith('/admin') ? next : '/admin')
}

export async function logoutAction() {
  await signOutUser()
  revalidatePath('/admin', 'layout')
  redirect('/admin/login')
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (next !== confirm) return { error: 'الكلمتان الجديدتان غير متطابقتين.' }

  const { error } = await changeOwnPassword(current, next)
  if (error) return { error }

  revalidatePath('/admin', 'layout')
  return { ok: 'تمّ تغيير كلمة السرّ.' }
}

export async function updateOwnNameAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const staff = await requireSession()
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (fullName.length < 2) return { error: 'الاسم قصير جدّاً.' }

  const { error } = await db
    .from('staff')
    .update({ full_name: fullName })
    .eq('user_id', staff.userId)
  if (error) return { error: 'تعذّر الحفظ: ' + error.message }

  revalidatePath('/admin', 'layout')
  return { ok: 'تمّ حفظ الاسم.' }
}
