'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { sendPropertyConfirmation } from '@/lib/sms/winsms'
import { headers } from 'next/headers'
import { db } from '@/lib/supabase/server'
import { propertySchema } from '@/lib/property-schema'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'

export type PropertyState = {
  ok: boolean
  error?: 'banner' | 'rateLimited' | 'server'
  fields?: string[]
}

const recent = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 10

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > MAX_PER_WINDOW
}

/** تسجيل عرض عقار — يدخل بحالة "في انتظار المراجعة" ولا يظهر لأحد قبلها */
export async function submitProperty(
  _prev: PropertyState,
  formData: FormData
): Promise<PropertyState> {
  if ((formData.get('website') as string)?.length) return { ok: false, error: 'server' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = propertySchema.safeParse({
    ...raw,
    negotiable: raw.negotiable === 'on',
    consent: raw.consent === 'on',
  })

  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(
      Boolean
    )
    console.error('property validation failed:', fields.join(', '))
    return { ok: false, error: 'banner', fields }
  }

  const d = parsed.data
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip) || rateLimited(d.ownerPhone)) return { ok: false, error: 'rateLimited' }

  const { data: inserted, error } = await db
    .from('properties')
    .insert({
      kind: d.kind,
      gov_code: d.govCode,
      delegation_id: d.delegationId,
      imada_id: d.imadaId,
      address: d.address || null,
      lat: d.lat,
      lng: d.lng,
      area_m2: d.areaM2,
      built_area_m2: d.builtAreaM2,
      // عدد الغرف الإجمالي يُشتقّ: غرف النوم + الصالونات. لم نعد نسأله مرّتين.
      rooms:
        d.rooms ??
        (d.bedrooms != null || d.livingRooms != null
          ? (d.bedrooms ?? 0) + (d.livingRooms ?? 0)
          : null),
      price_tnd: d.priceTnd,
      negotiable: d.negotiable,
      legal_status: d.legalStatus,
      bedrooms: d.bedrooms,
      living_rooms: d.livingRooms,
      bathrooms: d.bathrooms,
      floors: d.floors,
      floor_number: d.floorNumber,
      year_built: d.yearBuilt,
      condition: d.condition,
      garage: d.garage,
      garden: d.garden,
      terrace: d.terrace,
      elevator: d.elevator,
      furnished: d.furnished,
      water_connected: d.waterConnected,
      power_connected: d.powerConnected,
      road_access: d.roadAccess,
      frontage_m: d.frontageM,
      buildable: d.buildable,
      description: d.description || null,
      owner_name: d.ownerName,
      owner_phone: d.ownerPhone,
      owner_email: d.ownerEmail || null,
      owner_note: d.ownerNote || null,
      consent_at: new Date().toISOString(),
      status: 'pending',
    })
    .select('id, ref_code')
    .single()

  if (error || !inserted) {
    console.error('insert property', error)
    return { ok: false, error: 'server' }
  }

  const locale = String(formData.get('locale') ?? '')
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE

  const refCode = String(inserted.ref_code)
  after(() => sendPropertyConfirmation(String(inserted.id), refCode, d.ownerPhone, l))

  redirect(`/${l}/proprietaire/merci?ref=${refCode}`)
}
