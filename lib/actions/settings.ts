'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { CRITERIA, normalizeWeights, type Thresholds, type Weights } from '@/lib/support-assessment'

export type SettingsState = { ok: boolean; error?: string }

/**
 * أوزان دراسة المساندة وحدود فئاتها — من «المعطيات المرجعية».
 * تُحفظ كما أدخلها الفريق (لا مُسوّاة) حتى يقرأها كما كتبها؛ التسوية إلى
 * 100 تقع عند الحساب. الحدود يلزم تكون متنازلة: أولوية > مؤهّل > للمراجعة.
 */
export async function saveAssessmentConfigAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { ok: false, error: 'غير مصرّح' }

  const weights = {} as Weights
  for (const c of CRITERIA) {
    const n = Number(String(formData.get(`w_${c}`) ?? '').trim())
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: `وزن غير صالح: ${c}` }
    weights[c] = n
  }
  const sum = CRITERIA.reduce((s, c) => s + weights[c], 0)
  if (sum <= 0) return { ok: false, error: 'مجموع الأوزان صفر — لا معنى للدراسة' }

  const t: Thresholds = {
    priority: Number(String(formData.get('t_priority') ?? '').trim()),
    eligible: Number(String(formData.get('t_eligible') ?? '').trim()),
    review: Number(String(formData.get('t_review') ?? '').trim()),
  }
  for (const v of Object.values(t)) {
    if (!Number.isFinite(v) || v < 0 || v > 100) return { ok: false, error: 'حدّ غير صالح (0–100)' }
  }
  if (!(t.priority > t.eligible && t.eligible > t.review)) {
    return { ok: false, error: 'الحدود يلزم تكون متنازلة: أولوية > مؤهّل > للمراجعة' }
  }

  const { error } = await db.from('app_settings').upsert(
    [
      {
        key: 'support.assessment_weights',
        value: weights,
        description: `أوزان معايير دراسة طلب المساندة — مجموعها ${sum}${sum !== 100 ? ' (تُسوّى إلى 100 عند الحساب)' : ''}`,
      },
      {
        key: 'support.band_thresholds',
        value: t,
        description: 'حدود الفئات: أولوية ≥ · مؤهّل ≥ · للمراجعة ≥ · وما دونها غير مؤهّل',
      },
    ],
    { onConflict: 'key' }
  )
  if (error) {
    console.error('save assessment config', error)
    return { ok: false, error: 'تعذّر الحفظ' }
  }

  // الدرجات المحفوظة سابقاً بقيت بأوزانها القديمة: نعلم الفريق بذلك بدل ما نعيد حسابها صامتين
  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'support.assessment', weights: normalizeWeights(weights), thresholds: t },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  revalidatePath('/admin/reference')
  revalidatePath('/admin/support')
  return { ok: true }
}


/** قنوات اتّصال المنصّة التي تظهر في صفحات الشكر — فارغة = لا تُعرض */
export async function saveContactSettingsAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const str = (k: string) => String(formData.get(k) ?? '').trim().slice(0, 120)
  const rows = [
    { key: 'contact.phone', value: str('phone') },
    { key: 'contact.whatsapp', value: str('whatsapp').replace(/[^\d+]/g, '') },
    { key: 'contact.email', value: str('email') },
    { key: 'contact.hours', value: str('hours') },
  ]
  const { error } = await db.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) console.error('save contact settings', error)
  revalidatePath('/admin/reference')
  revalidatePath('/ar/reseau/merci')
  revalidatePath('/fr/reseau/merci')
}
