import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { upsertPartnerAction } from '@/lib/actions/solutions'

export const metadata = { title: 'الشركاء — اللَّبنة' }
export const dynamic = 'force-dynamic'

const PARTNER_KINDS: Record<string, string> = {
  public: 'جهة عمومية',
  bank: 'مؤسّسة مالية',
  company: 'شركة خاصة',
  developer: 'باعث عقاري',
  contractor: 'مقاول',
  supplier: 'مزوّد مواد',
  association: 'جمعية',
  other: 'أخرى',
}

type Partner = {
  id: string
  name: string
  kind: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
}

export default async function PartnersPage() {
  await requirePermission('reference.manage')

  const { data } = await db.from('partners').select('*').order('name')
  const partners = (data ?? []) as Partner[]

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-green">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-2 text-2xl font-semibold">الشركاء</h1>
      <p className="mt-1 max-w-2xl text-sm leading-7 text-muted">
        كلّ من ينجّم يساهم في حلّ: جهة عمومية، بنك، شركة، باعث، مقاول، مزوّد مواد، أو جمعية.
        الشريك يتسنّدله مهامّ داخل ملفّ الحريف، ويتّبع الفريق تقدّمها.
      </p>

      {/* شريك جديد */}
      <section className="mt-8 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">إضافة شريك</h2>
        <form action={upsertPartnerAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الاسم</span>
            <input name="name" required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">النوع</span>
            <select name="kind" className={inputCls} defaultValue="contractor">
              {Object.entries(PARTNER_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">شخص الاتصال</span>
            <input name="contact_name" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الهاتف</span>
            <input name="phone" dir="ltr" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">ملاحظات</span>
            <input name="notes" className={inputCls} />
          </label>
          <button className="justify-self-start rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
            إضافة
          </button>
        </form>
      </section>

      {/* القائمة */}
      <div className="mt-8 flex flex-col gap-3">
        {partners.length === 0 && (
          <p className="rounded border border-line bg-surface p-8 text-center text-muted">
            ما فمّا حتّى شريك مسجّل.
          </p>
        )}
        {partners.map((p) => (
          <form
            key={p.id}
            action={upsertPartnerAction}
            className="flex flex-wrap items-end gap-3 rounded border border-line bg-surface p-4"
          >
            <input type="hidden" name="partner_id" value={p.id} />
            <label className="block min-w-[180px] flex-1">
              <span className="mb-1.5 block text-xs text-muted">الاسم</span>
              <input name="name" defaultValue={p.name} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">النوع</span>
              <select name="kind" defaultValue={p.kind} className={inputCls}>
                {Object.entries(PARTNER_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">الهاتف</span>
              <input name="phone" defaultValue={p.phone ?? ''} dir="ltr" className={inputCls} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={p.is_active}
                className="size-4 accent-[#0e5138]"
              />
              نشط
            </label>
            <button className="rounded border border-line px-4 py-2 text-sm hover:border-green hover:text-green">
              حفظ
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-green'
