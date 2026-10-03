import { db } from '@/lib/supabase/server'
import { saveBankTermsAction } from '@/lib/actions/settings'

/**
 * البنوك وشروطها التقديرية — في «المعطيات المرجعية».
 *
 * خانة فارغة تعني «لا نعرف»: تقدير الحريف يبقى بالنسبة العامّة ويقول له
 * ذلك. نسبة أو مدّة تُسجَّل هنا تدخل حساب كلّ من يختار هذا البنك في
 * الاستمارة والمحاكي — فلا تُسجَّل بلا مصدر وتاريخ.
 */
export default async function BankTermsSection() {
  const { data, error } = await db
    .from('banks')
    .select(
      'code, name_ar, is_islamic, is_active, indicative_rate_pct, max_years, max_share_pct, terms_source, terms_verified_at, sort_order'
    )
    .order('sort_order')
  const banks = data ?? []
  const inp = 'num w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm'
  const cols = 'lg:grid-cols-[1.5fr_0.6fr_0.6fr_0.6fr_1.6fr_0.9fr_0.5fr_auto]'

  return (
    <section className="mt-10 rounded border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">البنوك: الشروط التقديرية</h2>
      <p className="mt-1 max-w-3xl text-xs leading-6 text-muted">
        الحريف يختار في الاستمارة والمحاكي البنك اللي يفكّر فيه ومدّة التمويل. الخانة الفارغة معناها
        «ما نعرفوش»: الحساب يبقى بالنسبة العامّة ويتقال للحريف. كلّ نسبة ولا مدّة تتسجّل هنا تدخل حساب
        كلّ من يختار البنك، فما تتسجّلش بلا مصدر وتاريخ.
      </p>
      {error && (
        <p className="mt-3 text-xs text-[#8c2f22]">جدول البنوك غير متاح — طبّق الترحيل 0046_banks_loan_terms.</p>
      )}

      <div className={`mt-4 hidden gap-2 text-xs text-muted lg:grid ${cols}`}>
        <span>البنك</span>
        <span>النسبة ٪</span>
        <span>أقصى مدّة</span>
        <span>التمويل ٪</span>
        <span>المصدر</span>
        <span>تاريخ التثبّت</span>
        <span>نشط</span>
        <span />
      </div>
      <div className="mt-2 divide-y divide-line">
        {banks.map((b) => (
          <form
            key={b.code}
            action={saveBankTermsAction}
            className={`grid items-center gap-2 py-3 sm:grid-cols-2 ${cols}`}
          >
            <input type="hidden" name="code" value={b.code} />
            <div className="text-sm font-medium">
              {b.name_ar}
              {b.is_islamic && (
                <span className="ms-2 rounded bg-gold-soft px-1.5 py-0.5 text-[10px] text-gold">صيرفة إسلامية</span>
              )}
            </div>
            <input name="rate" inputMode="decimal" defaultValue={b.indicative_rate_pct ?? ''} placeholder="—" aria-label="النسبة السنوية ٪" className={inp} />
            <input name="max_years" inputMode="numeric" defaultValue={b.max_years ?? ''} placeholder="—" aria-label="أقصى مدّة بالسنوات" className={inp} />
            <input name="max_share" inputMode="decimal" defaultValue={b.max_share_pct ?? ''} placeholder="—" aria-label="أقصى نسبة تمويل ٪" className={inp} />
            <input
              name="source"
              defaultValue={b.terms_source ?? ''}
              placeholder="مثال: عرض مكتوب من الفرع"
              aria-label="مصدر الشروط"
              className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs"
            />
            <input name="verified_at" type="date" defaultValue={b.terms_verified_at ?? ''} aria-label="تاريخ التثبّت" className={inp} />
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" name="active" defaultChecked={b.is_active} className="size-4 accent-[#1d3a5f]" />
              نشط
            </label>
            <button className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-deep">احفظ</button>
          </form>
        ))}
      </div>
    </section>
  )
}
