'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'

const CODE = /^[A-Za-z0-9_-]{1,20}$/

function refresh() {
  revalidatePath('/admin/standing')
  revalidatePath('/admin/bordereau')
  revalidatePath('/ar')
  revalidatePath('/fr')
  revalidatePath('/ar/standing')
  revalidatePath('/fr/standing')
  revalidatePath('/ar/demande')
  revalidatePath('/fr/demande')
}

/**
 * إضافة مستوى تشطيب أو تحيينه.
 *
 * هذا هو المقصد من الوحدة كلّها: مستوى جديد يتزاد من هنا، بلا هجرة
 * ولا مطوّر. المستوى الجديد يبدأ بتوزيع منسوخ من أقرب مستوى موجود
 * حتى لا يبدأ من صفحة بيضاء.
 */
export async function upsertStandingLevelAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const nameAr = String(formData.get('name_ar') ?? '').trim()
  const price = Number(String(formData.get('price_ht_m2') ?? '').trim())
  if (!CODE.test(code) || !nameAr || !Number.isFinite(price) || price <= 0) return

  const str = (k: string) => String(formData.get(k) ?? '').trim() || null
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v ? Number(v) : null
  }

  const { data: existing } = await db
    .from('standing_levels')
    .select('code')
    .eq('code', code)
    .maybeSingle()

  const { error } = await db.from('standing_levels').upsert(
    {
      code,
      name_ar: nameAr,
      name_fr: str('name_fr'),
      description_ar: str('description_ar'),
      description_fr: str('description_fr'),
      price_ht_m2: price,
      price_min_ht: num('price_min_ht') ?? price,
      price_max_ht: num('price_max_ht') ?? price,
      sort_order: num('sort_order') ?? 99,
      is_active: formData.get('is_active') !== 'off',
      updated_by: actor.userId,
    },
    { onConflict: 'code' }
  )

  if (error) {
    console.error('upsert standing level', error)
    return
  }

  // مستوى جديد: انسخ توزيع أقرب مستوى بالسعر حتى يبدأ من أرضية معقولة
  if (!existing) {
    const { data: nearest } = await db
      .from('standing_levels')
      .select('code, price_ht_m2')
      .neq('code', code)
      .eq('is_active', true)

    const source = (nearest ?? []).sort(
      (a, b) =>
        Math.abs(Number(a.price_ht_m2) - price) - Math.abs(Number(b.price_ht_m2) - price)
    )[0]

    if (source) {
      const { data: shares } = await db
        .from('standing_lot_shares')
        .select('lot_code, share_pct')
        .eq('standing_code', source.code)

      if (shares?.length) {
        await db.from('standing_lot_shares').insert(
          shares.map((s) => ({
            standing_code: code,
            lot_code: s.lot_code,
            share_pct: s.share_pct,
            note: `منسوخ من ${source.code} عند إنشاء المستوى`,
          }))
        )
      }
    }
  }

  refresh()
}

/**
 * تحيين توزيع مستوى على الـLots.
 * لا نفرض مجموع 100%: الإدارة قد تحفظ عملاً ناقصاً وتكمّله بعدُ،
 * والشاشة تعرض الانحراف بوضوح.
 */
export async function updateLotSharesAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('standing_code') ?? '').trim()
  if (!CODE.test(code)) return

  const rows: { standing_code: string; lot_code: number; share_pct: number }[] = []
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^share_(\d+)$/)
    if (!m) continue
    const pct = Number(String(value).trim())
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) continue
    rows.push({ standing_code: code, lot_code: Number(m[1]), share_pct: pct })
  }
  if (!rows.length) return

  const { error } = await db
    .from('standing_lot_shares')
    .upsert(rows, { onConflict: 'standing_code,lot_code' })

  if (error) console.error('update lot shares', error)
  refresh()
}

/** توزيع النسب بالتساوي على الـLots — نقطة بداية عند إنشاء مستوى بلا مرجع */
export async function equaliseSharesAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('standing_code') ?? '').trim()
  if (!CODE.test(code)) return

  const { data: lots } = await db.from('lots').select('code').eq('is_active', true)
  if (!lots?.length) return

  const pct = Math.round((100 / lots.length) * 1000) / 1000
  const { error } = await db.from('standing_lot_shares').upsert(
    lots.map((l) => ({ standing_code: code, lot_code: l.code, share_pct: pct })),
    { onConflict: 'standing_code,lot_code' }
  )

  if (error) console.error('equalise shares', error)
  refresh()
}
