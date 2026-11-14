import { redirect } from 'next/navigation'
import { isLocale, type Locale } from '@/lib/i18n'

/**
 * الميزانية صارت خطوةً في المسار لا صفحةً وحدها.
 *
 * ماكيت الواجهة لا يعرف صفحة ميزانية مستقلّة: السؤال «قدّاش عندك»
 * يأتي بعد المشروع والحاجة، ويُجاب بعد حسابٍ متثبَّت منه. وصفحةٌ تعطي
 * التقدير بلا حساب تلتفّ على القاعدة من الباب الخلفي.
 *
 * والمسار القديم يبقى يعمل — من حفظ الرابط أو شاركه يصل إلى نفس
 * الخطوة بنفس معطياته، لا إلى 404.
 */
export default async function BudgetRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'

  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  p.set('e', '3')
  redirect(`/${locale}/projet?${p.toString()}`)
}
