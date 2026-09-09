import 'server-only'
import { db } from '@/lib/supabase/server'
import type { RequestData } from '@/lib/schema'

/**
 * إجابات صاحب المطلب التي كانت اللوحة تعمّرها بيدها.
 *
 * ثلاثة جداول كانت تُملأ بعد مكالمة أو اثنتين: مواصفات المشروع، المسار
 * الاجتماعي، وقائمة الوثائق. الآن تصل مع المطلب، والمستشار يفتح ملفّاً
 * جاهزاً بدل أن يبني واحداً من الصفر.
 *
 * قاعدة واحدة تحكم الثلاثة: **لا نمسّ ما تقرّره الإدارة**.
 * `is_priority` و`notes` و`decided_by` في المسار الاجتماعي قرار فريق،
 * و`available` في الوثائق تثبّت فريق. نكتب أعمدة الحريف وحدها، وupsert
 * في PostgREST لا يحدّث إلّا الأعمدة المرسلة.
 *
 * لا ترمي أبداً: مطلب وصل ونقص فيه سطر مواصفات أهون من مطلب ضاع.
 */
export async function writeClientAnswers(requestId: string, d: RequestData): Promise<void> {
  const hasSpecs =
    d.levels !== null ||
    d.bathrooms !== null ||
    d.livingRooms !== null ||
    d.kitchens !== null ||
    d.garage ||
    d.terrasse ||
    d.jardin ||
    d.desiredAreaM2 !== null ||
    d.constructionSystem !== null

  if (hasSpecs) {
    // رمز نظام مجهول يكسر المفتاح الخارجي، فيسقط **سطر المواصفات كلّه**
    // لا الرمز وحده. القاعدة أعلاه: لا ترمي أبداً — فنُسقط الرمز ونحتفظ
    // بالمساحة والطوابق والغرف.
    let systemCode = d.constructionSystem
    if (systemCode) {
      const { data: sys } = await db
        .from('construction_systems')
        .select('code')
        .eq('code', systemCode)
        .eq('is_active', true)
        .maybeSingle()
      if (!sys) {
        console.warn('طريقة بناء مجهولة، أُسقطت:', systemCode)
        systemCode = null
      }
    }

    const { error } = await db.from('project_configs').upsert(
      {
        request_id: requestId,
        surface_m2: d.desiredAreaM2,
        // levels not null في القاعدة: الغائب يعني أرضياً
        levels: d.levels ?? 1,
        bedrooms: d.bedrooms,
        bathrooms: d.bathrooms,
        living_rooms: d.livingRooms,
        kitchens: d.kitchens,
        garage: d.garage,
        terrasse: d.terrasse,
        jardin: d.jardin,
        standing: d.standing,
        system_code: systemCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'request_id' }
    )
    if (error) console.error('project_configs (إجابات الحريف)', error)
  }

  const hasSocial =
    d.householdSize !== null ||
    d.dependents !== null ||
    d.hasDisability ||
    d.housingCondition !== null ||
    d.incomeStability !== null ||
    d.isRenting

  if (hasSocial) {
    const { error } = await db.from('social_assessments').upsert(
      {
        request_id: requestId,
        household_size: d.householdSize,
        dependents: d.dependents,
        has_disability: d.hasDisability,
        housing_condition: d.housingCondition,
        income_stability: d.incomeStability,
        is_renting: d.isRenting,
        // الكراء بلا «كاري» لا معنى له: من رفع التأشيرة يُمحى مبلغه
        rent_tnd: d.isRenting ? d.rentTnd : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'request_id' }
    )
    if (error) console.error('social_assessments (إجابات الحريف)', error)
  }

  await writeDeclaredDocuments(requestId, d.documents)
}

/**
 * ما يقول صاحب المطلب إنّه عنده.
 *
 * الرموز تجي من المتصفّح، فلا نثق بها: نقابلها بدليل القاعدة ونرمي ما
 * ليس فيه. المخطّط تحقّق من الشكل، وهنا يُتحقَّق من الانتماء.
 *
 * نكتب المؤشَّر ونصفّر البقية: من رفع التأشير في تعديل لاحق يعني «ما
 * عادش عندي» أو «غلطت»، وترك القديم يعطي الفريق قائمة كاذبة.
 * `available` لا تُمسّ في الحالتين — هي تثبّت الفريق لا تصريح الحريف.
 */
export async function writeDeclaredDocuments(
  requestId: string,
  codes: readonly string[]
): Promise<void> {
  const now = new Date().toISOString()

  const { data: catalog, error: catErr } = await db
    .from('request_doc_catalog')
    .select('code, name_ar')
    .eq('is_active', true)
  if (catErr) {
    console.error('request_doc_catalog read', catErr)
    return
  }

  const names = new Map((catalog ?? []).map((c) => [String(c.code), String(c.name_ar)]))
  const valid = [...new Set(codes)].filter((c) => names.has(c))

  if (valid.length) {
    const { error } = await db.from('request_documents').upsert(
      valid.map((code) => ({
        request_id: requestId,
        doc_code: code,
        // الاسم يبقى للتوافق مع السطور القديمة وشاشات تقرأ بالاسم
        doc_type: names.get(code)!,
        declared: true,
        declared_at: now,
        updated_at: now,
      })),
      { onConflict: 'request_id,doc_code' }
    )
    if (error) console.error('request_documents declare', error)
  }

  // الرفع بالمعرّفات: نقرا ثمّ نكتب، بلا تركيب قوائم داخل مرشّح نصّي
  const { data: stale } = await db
    .from('request_documents')
    .select('id, doc_code')
    .eq('request_id', requestId)
    .eq('declared', true)

  const keep = new Set(valid)
  const toClear = (stale ?? [])
    .filter((row) => !row.doc_code || !keep.has(String(row.doc_code)))
    .map((row) => row.id as number)

  if (toClear.length) {
    const { error: clearErr } = await db
      .from('request_documents')
      .update({ declared: false, declared_at: null, updated_at: now })
      .in('id', toClear)
    if (clearErr) console.error('request_documents undeclare', clearErr)
  }
}
