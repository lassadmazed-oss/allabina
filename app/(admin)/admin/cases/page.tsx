import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { upsertCaseStudyAction } from '@/lib/actions/solutions'
import { deleteCasePhotoAction, updateCasePhotoAction } from '@/lib/actions/photos'
import CasePhotoUpload from '@/components/CasePhotoUpload'
import { PHOTO_STAGES, photoPublicUrl, sortPhotos, type CasePhoto } from '@/lib/photos'

const STAGE_AR: Record<string, string> = { before: 'قبل', progress: 'أثناء الأشغال', after: 'بعد' }

export const metadata = { title: 'حالات تمّ إنجازها — اللَّبنة' }
export const dynamic = 'force-dynamic'

const KINDS: Record<string, string> = {
  build_on_land: 'بناء فوق أرض الحريف',
  land_and_house: 'أرض وبناء',
  apartment: 'شراء شقة',
  house: 'شراء منزل',
  renovation: 'ترميم أو توسعة',
  other: 'حالة أخرى',
}

type CaseRow = {
  id: string
  title_ar: string
  kind: string
  delegation_id: number | null
  completed_at: string | null
  consent_given: boolean
  published: boolean
  anonymised: boolean
}

export default async function CasesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>
}) {
  await requirePermission('requests.update')
  const { case: selectedId } = await searchParams

  const [{ data: cases }, { data: delegs }] = await Promise.all([
    db.from('case_studies').select('*').order('created_at', { ascending: false }),
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX').order('id'),
  ])

  const rows = (cases ?? []) as CaseRow[]
  const selected = selectedId ? rows.find((c) => c.id === selectedId) ?? null : null

  const { data: photosRaw } = selected
    ? await db.from('case_photos').select('*').eq('case_id', selected.id)
    : { data: [] as CasePhoto[] }
  const photos = sortPhotos((photosRaw ?? []) as CasePhoto[])
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const photoCount = new Map<string, number>()
  if (rows.length) {
    const { data: counts } = await db.from('case_photos').select('case_id')
    for (const r of (counts ?? []) as { case_id: string }[]) {
      photoCount.set(r.case_id, (photoCount.get(r.case_id) ?? 0) + 1)
    }
  }
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-2 text-2xl font-semibold">حالات تمّ إنجازها</h1>
      <p className="mt-1 max-w-2xl text-sm leading-7 text-muted">
        ما يظهر في الصفحة العمومية. <b>ما تتنشر حتّى حالة بلا موافقة صاحبها</b> — القيد محروس في
        قاعدة البيانات نفسها، لا في هذي الشاشة فقط.
      </p>

      {/* حالة جديدة */}
      <section className="mt-8 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">إضافة حالة</h2>
        <form action={upsertCaseStudyAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">العنوان (عربي)</span>
            <input name="title_ar" required className={inputCls} placeholder="مثال: دار 100 م² فوق أرض العائلة في عقارب" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">العنوان (فرنسي)</span>
            <input name="title_fr" className={inputCls} />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">المشكلة (عربي)</span>
            <textarea name="problem_ar" required rows={2} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">المشكلة (فرنسي)</span>
            <textarea name="problem_fr" rows={2} className={inputCls} />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">الحلّ (عربي)</span>
            <textarea name="solution_ar" required rows={2} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">الحلّ (فرنسي)</span>
            <textarea name="solution_fr" rows={2} className={inputCls} />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">النتيجة (عربي)</span>
            <input name="result_ar" className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">نوع الحالة</span>
            <select name="kind" className={inputCls} defaultValue="build_on_land">
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المعتمدية</span>
            <select name="delegation_id" className={inputCls} defaultValue="">
              <option value="">—</option>
              {(delegs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="gov_code" value="SFX" />

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المساحة (م²)</span>
            <input name="area_m2" type="number" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">مدّة الإنجاز (شهر)</span>
            <input name="duration_months" type="number" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">تاريخ الإنجاز</span>
            <input name="completed_at" type="date" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">رابط صورة «قبل»</span>
            <input name="photo_before" dir="ltr" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">رابط صورة «بعد»</span>
            <input name="photo_after" dir="ltr" className={inputCls} />
          </label>

          <div className="rounded border border-gold-light bg-gold-soft p-4 text-sm sm:col-span-2">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="consent_given" className="mt-1 size-4 accent-[#1d3a5f]" />
              <span className="leading-7">
                <b>الحريف وافق على نشر حالته.</b> بلا هالموافقة ما تتنشرش الحالة، حتّى لو
                اخترت النشر.
              </span>
            </label>
            <label className="mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                name="anonymised"
                defaultChecked
                className="size-4 accent-[#1d3a5f]"
              />
              <span>مجهّلة الهوية (بلا اسم الحريف)</span>
            </label>
            <label className="mt-3 flex items-center gap-3">
              <input type="checkbox" name="published" className="size-4 accent-[#1d3a5f]" />
              <span>انشرها في الصفحة العمومية</span>
            </label>
          </div>

          <button className="justify-self-start rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ الحالة
          </button>
        </form>
      </section>

      {/* ألبوم الحالة المختارة */}
      {selected && (
        <section className="mt-8 rounded border border-brand bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">
              ألبوم: {selected.title_ar}
              <span className="num ms-2 text-xs font-normal text-faint">{photos.length} صورة</span>
            </h2>
            <Link href="/admin/cases" className="text-xs text-muted hover:text-brand">
              سكّر ←
            </Link>
          </div>
          <p className="mt-1 text-xs leading-6 text-muted">
            الصور تظهر للعموم فقط إذا كانت الحالة منشورة — والنشر محروس بموافقة صاحبها. الترتيب:
            قبل ← أثناء ← بعد، وداخل كلّ مرحلة حسب الترتيب ثمّ تاريخ اللقطة.
          </p>

          <div className="mt-5">
            <CasePhotoUpload caseId={selected.id} />
          </div>

          {photos.length > 0 && (
            <ul className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((ph) => (
                <li key={ph.id} className="rounded border border-line bg-surface-2 p-3">
                  <img
                    src={photoPublicUrl(baseUrl, ph.storage_path)}
                    alt={ph.caption_ar ?? STAGE_AR[ph.stage]}
                    className="aspect-[4/3] w-full rounded object-cover"
                    loading="lazy"
                  />
                  <form action={updateCasePhotoAction} className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <input type="hidden" name="photo_id" value={ph.id} />
                    <select name="stage" defaultValue={ph.stage} className={inputCls}>
                      {PHOTO_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {STAGE_AR[st]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      name="taken_at"
                      defaultValue={ph.taken_at ?? ''}
                      className={`${inputCls} num`}
                    />
                    <input
                      name="caption_ar"
                      defaultValue={ph.caption_ar ?? ''}
                      placeholder="تعليق عربي"
                      className={`${inputCls} col-span-2`}
                    />
                    <input
                      name="caption_fr"
                      defaultValue={ph.caption_fr ?? ''}
                      placeholder="Légende"
                      dir="ltr"
                      className={`${inputCls} col-span-2`}
                    />
                    <input
                      type="number"
                      name="sort_order"
                      defaultValue={ph.sort_order}
                      title="الترتيب داخل المرحلة"
                      className={`${inputCls} num`}
                    />
                    <button className="rounded border border-line bg-surface px-3 py-1.5 hover:border-brand hover:text-brand">
                      حفظ
                    </button>
                  </form>
                  <form action={deleteCasePhotoAction} className="mt-2">
                    <input type="hidden" name="photo_id" value={ph.id} />
                    <button className="text-xs text-[#8c2f22] hover:underline">احذف الصورة</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* القائمة */}
      <div className="mt-8 overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-surface-2">
              <Th>العنوان</Th>
              <Th>النوع</Th>
              <Th>المعتمدية</Th>
              <Th>الإنجاز</Th>
              <Th>الموافقة</Th>
              <Th>النشر</Th>
              <Th>الصور</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  ما فمّا حتّى حالة مسجّلة.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{c.title_ar}</td>
                <td className="px-4 py-3">{KINDS[c.kind] ?? c.kind}</td>
                <td className="px-4 py-3">
                  {c.delegation_id ? delegName.get(c.delegation_id) ?? '—' : '—'}
                </td>
                <td className="num px-4 py-3 text-xs text-faint">{c.completed_at ?? '—'}</td>
                <td className="px-4 py-3">
                  {c.consent_given ? (
                    <span className="rounded bg-brand-soft px-2 py-0.5 text-xs text-brand">
                      موافق
                    </span>
                  ) : (
                    <span className="rounded bg-gold-soft px-2 py-0.5 text-xs text-gold">
                      بلا موافقة
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.published ? (
                    <span className="rounded bg-brand-soft px-2 py-0.5 text-xs text-brand">
                      منشورة
                    </span>
                  ) : (
                    <span className="text-xs text-faint">غير منشورة</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/cases?case=${c.id}`}
                    className="num text-xs text-brand hover:underline"
                  >
                    {photoCount.get(c.id) ?? 0} · الألبوم ←
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}
