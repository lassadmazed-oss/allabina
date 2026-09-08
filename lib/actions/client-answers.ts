import 'server-only'
import { db } from '@/lib/supabase/server'
import { docLabelOf } from '@/lib/documents'
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
    d.desiredAreaM2 !== null

  if (hasSpecs) {
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
    d.incomeStability !== null

  if (hasSocial) {
    const { error } = await db.from('social_assessments').upsert(
      {
        request_id: requestId,
        household_size: d.householdSize,
        dependents: d.dependents,
        has_disability: d.hasDisability,
        housing_condition: d.housingCondition,
        income_stability: d.incomeStability,
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
 * نكتب السطور المؤشَّرة ونصفّر البقية: من رفع التأشير في تعديل لاحق
 * يعني «ما عادش عندي» أو «غلطت»، وترك القديم يعطي الفريق قائمة كاذبة.
 * `available` لا تُمسّ في الحالتين — هي تثبّت الفريق لا تصريح الحريف.
 */
export async function writeDeclaredDocuments(
  requestId: string,
  codes: readonly string[]
): Promise<void> {
  const labels = codes.map(docLabelOf).filter((l): l is string => Boolean(l))
  const now = new Date().toISOString()

  if (labels.length) {
    const { error } = await db.from('request_documents').upsert(
      labels.map((doc_type) => ({
        request_id: requestId,
        doc_type,
        declared: true,
        declared_at: now,
        updated_at: now,
      })),
      { onConflict: 'request_id,doc_type' }
    )
    if (error) console.error('request_documents declare', error)
  }

  // الرفع بالمعرّفات لا بمرشّح `not in`: أسماء الوثائق عربية وفيها
  // فواصل وشرطات مائلة، وتركيبها داخل قائمة PostgREST يفتح باب اقتباس
  // يصمت حين يخطئ بدل أن يعلن. القراءة ثمّ الكتابة أوضح وأأمن.
  const { data: stale } = await db
    .from('request_documents')
    .select('id, doc_type')
    .eq('request_id', requestId)
    .eq('declared', true)

  const toClear = (stale ?? [])
    .filter((row) => !labels.includes(String(row.doc_type)))
    .map((row) => row.id as number)

  if (toClear.length) {
    const { error: clearErr } = await db
      .from('request_documents')
      .update({ declared: false, declared_at: null, updated_at: now })
      .in('id', toClear)
    if (clearErr) console.error('request_documents undeclare', clearErr)
  }
}
