'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { mediaRejection, nextSortOrder } from '@/lib/article-media'
import { PRODUCT_MEDIA_BUCKET, productMediaPath } from '@/lib/products'
import { parseSpecs } from '@/lib/catalog'

/**
 * إدارة المنتجات.
 *
 * ثلاثة أفعال هنا تحرس ثلاث حدود:
 *   · تثبيت السعر فعلٌ مستقلّ عن تحريره — من يكتب رقماً لا يصادق عليه
 *     بنفس الضغطة، وإلّا صارت الخانة زينة.
 *   · التغطية تُكتب أو تبقى فارغة؛ لا قيمة افتراضية تُدسّ.
 *   · الصورة لا تُرفع بلا مصدر وإذن — لا تُنشر بلا، بل لا تُرفع.
 */
function refresh(code?: string) {
  revalidatePath('/admin/produits')
  if (code) revalidatePath(`/admin/produits/${code}`)
}

const num = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ─────────────────────────────────────────────── تحرير المنتَج

export async function saveProductAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  if (!code) return

  const price = num(formData.get('price'))
  const { data: before } = await db
    .from('products')
    .select('id, price, price_verified')
    .eq('code', code)
    .maybeSingle()
  if (!before) return

  // تبديل السعر يُسقط تثبيته: رقمٌ جديد لم يؤكّده أحد بعد
  const priceChanged = price !== null && Number(before.price ?? NaN) !== price

  const { error } = await db
    .from('products')
    .update({
      name_ar: String(formData.get('name_ar') ?? '').trim().slice(0, 200),
      name_fr: String(formData.get('name_fr') ?? '').trim().slice(0, 200) || null,
      brand: String(formData.get('brand') ?? '').trim().slice(0, 80) || null,
      range_name: String(formData.get('range_name') ?? '').trim().slice(0, 80) || null,
      pack_size: num(formData.get('pack_size')),
      pack_unit: String(formData.get('pack_unit') ?? '').trim().slice(0, 16) || null,
      price,
      price_includes_tax: formData.get('price_includes_tax') === 'on',
      tax_rate_pct: num(formData.get('tax_rate_pct')),
      price_source: String(formData.get('price_source') ?? '').trim().slice(0, 500) || null,
      price_checked_at: String(formData.get('price_checked_at') ?? '').trim() || null,
      standard: String(formData.get('standard') ?? '').trim().slice(0, 80) || null,
      specs: parseSpecs(String(formData.get('specs') ?? '')),
      notes: String(formData.get('notes') ?? '').trim().slice(0, 1000) || null,
      ...(priceChanged ? { price_verified: false } : {}),
    })
    .eq('code', code)
  if (error) {
    console.error('save product', error.message)
    return
  }

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'product', code, priceChanged },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  refresh(code)
}

/**
 * تثبيت السعر — فعلٌ منفصل عن تحريره.
 * «أكّدناه مع المورّد» قرارٌ يُسجَّل باسم صاحبه وتاريخه.
 */
export async function verifyProductPriceAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const on = formData.get('verified') === '1'
  if (!code) return

  await db
    .from('products')
    .update({
      price_verified: on,
      ...(on ? { price_checked_at: new Date().toISOString().slice(0, 10) } : {}),
    })
    .eq('code', code)

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'product.price_verified', code, verified: on },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  refresh(code)
}

/** النشر: قرار إدارة، ولا يُقبل على سعر غير متثبَّت منه */
export async function setProductPublicAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const open = formData.get('public') === '1'
  if (!code) return

  if (open) {
    const { data } = await db
      .from('products')
      .select('price, price_verified')
      .eq('code', code)
      .maybeSingle()
    // الشرط هنا وفي القراءة العمومية: شاشةٌ تنسى لا تنشر ما لا يُنشر
    if (!data || !data.price_verified || data.price === null) return refresh(code)
  }

  await db.from('products').update({ is_public: open }).eq('code', code)
  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'product.public', code, open },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))
  refresh(code)
}

// ─────────────────────────────────────────────── جسر التغطية

/**
 * «عبوة واحدة تغطّي قدّاش من وحدة المقال».
 * فارغ يبقى فارغاً: لا نحسب سعر مادّة على تغطية مخترَعة.
 */
export async function setCoverageAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const productId = String(formData.get('product_id') ?? '')
  const articleId = String(formData.get('article_id') ?? '')
  if (!productId || !articleId) return

  await db
    .from('article_products')
    .update({
      coverage_per_pack: num(formData.get('coverage')),
      coverage_note: String(formData.get('coverage_note') ?? '').trim().slice(0, 300) || null,
    })
    .eq('product_id', productId)
    .eq('article_id', articleId)

  refresh(code)
}

/** المادّة الافتراضية لمقال — واحدة لا اثنتان (فهرس فريد يحرسها) */
export async function setDefaultProductAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const productId = String(formData.get('product_id') ?? '')
  const articleId = String(formData.get('article_id') ?? '')
  if (!productId || !articleId) return

  // تُنزَع من الباقي أوّلاً، وإلّا رفض الفهرس الفريد الكتابة
  await db
    .from('article_products')
    .update({ is_default: false })
    .eq('article_id', articleId)
    .neq('product_id', productId)
  await db
    .from('article_products')
    .update({ is_default: true })
    .eq('article_id', articleId)
    .eq('product_id', productId)

  refresh(code)
}

// ─────────────────────────────────────────────── الصور

export type ProductMediaState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'product' | 'server' | 'forbidden' | 'rights'
}

export async function uploadProductMediaAction(
  _prev: ProductMediaState,
  formData: FormData
): Promise<ProductMediaState> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { ok: false, error: 'forbidden' }

  const code = String(formData.get('code') ?? '').trim()
  const credit = String(formData.get('credit') ?? '').trim().slice(0, 200)
  const license = String(formData.get('license') ?? '').trim().slice(0, 120)
  const sourceUrl = String(formData.get('source_url') ?? '').trim().slice(0, 500) || null
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)

  if (!code) return { ok: false, error: 'product' }
  if (!files.length) return { ok: false, error: 'empty' }
  // صور المنتجات ملك أصحابها: الحقوق شرط الرفع لا شرط النشر
  if (!credit || !license) return { ok: false, error: 'rights' }
  for (const f of files) {
    const rejection = mediaRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: product } = await db.from('products').select('id').eq('code', code).maybeSingle()
  if (!product) return { ok: false, error: 'product' }

  const { data: orders } = await db
    .from('product_media')
    .select('sort_order')
    .eq('product_id', product.id)
  let order = nextSortOrder((orders ?? []).map((o) => Number(o.sort_order)))

  let uploaded = 0
  for (const f of files) {
    const path = productMediaPath(String(product.id), f.type)
    const { error: upErr } = await db.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type, upsert: false })
    if (upErr) {
      console.error('product media upload', upErr.message)
      continue
    }
    const { error: rowErr } = await db.from('product_media').insert({
      product_id: product.id,
      storage_path: path,
      credit,
      license,
      source_url: sourceUrl,
      sort_order: order++,
      created_by: actor.userId,
    })
    if (rowErr) {
      await db.storage.from(PRODUCT_MEDIA_BUCKET).remove([path])
      console.error('product media row', rowErr.message)
      continue
    }
    uploaded++
  }

  refresh(code)
  return uploaded ? { ok: true, uploaded } : { ok: false, error: 'server' }
}

export async function deleteProductMediaAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const id = String(formData.get('id') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  if (!id) return

  const { data } = await db
    .from('product_media')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()
  await db.from('product_media').delete().eq('id', id)
  if (data?.storage_path) {
    await db.storage.from(PRODUCT_MEDIA_BUCKET).remove([String(data.storage_path)])
  }
  refresh(code)
}
