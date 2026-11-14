import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import PrintButton from '@/components/PrintButton'
import { db } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/user-session'
import { isDevisExpired } from '@/lib/devis'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { formatMoney, isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').account.devis
  return { title: t.pageTitle, robots: { index: false, follow: false } }
}

/**
 * عرض الحريف كما أُرسل إليه.
 *
 * ثلاثة حدود:
 *   · ملفّه هو — الملكية تُفحص في الاستعلام.
 *   · وما أُرسل إليه فقط: المسوّدة وما هو تحت المراجعة لا يخرجان.
 *     عرضٌ يراه قبل اعتماده يصير وعداً قبل أن يُقرّر.
 *   · وما يُعرض هو ما وُقّع عليه: السطر وكمّيته وسعره، بلا تقسيم
 *     التوريد واليد العاملة — تركيبةُ السعر شأنٌ داخلي.
 *
 * ولا PDF مولَّد في الخادم: مكتبةٌ ثقيلة وخطٌّ عربي يُدمج، والمتصفّح
 * يحفظ PDF من نافذة الطباعة. الصفحة مهيّأة للطباعة.
 */
const CLIENT_VISIBLE = ['sent', 'accepted', 'changes_requested', 'expired']

export default async function ClientDevisPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>
}) {
  const { locale: raw, ref } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.account.devis

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/compte`)

  const refCode = decodeURIComponent(ref)
  const { data: request } = await db
    .from('housing_requests')
    .select('id, ref_code, full_name')
    .eq('ref_code', refCode)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!request) notFound()

  const { data: devis } = await db
    .from('devis')
    .select(
      'id, ref_code, kind, version, status, total_ht, tax_rate_pct, valid_until, sent_at, created_at, inclusions, exclusions, payment_terms'
    )
    .eq('request_id', request.id)
    .in('status', CLIENT_VISIBLE)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!devis) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:py-20">
        <Link href={`/${locale}/compte`} className="text-sm text-muted underline underline-offset-4">
          {t.back}
        </Link>
        <p className="mt-6 leading-8 text-muted">{t.none}</p>
      </div>
    )
  }

  const { data: lines } = await db
    .from('devis_lines')
    .select('id, lot_name_ar, designation_ar, unit, quantity, pu_total_ht, total_ht')
    .eq('devis_id', devis.id)
    .order('sort_order')

  const totalHt = Number(devis.total_ht ?? 0)
  const rate = devis.tax_rate_pct === null ? null : Number(devis.tax_rate_pct)
  const ttc = rate === null ? null : totalHt * (1 + rate / 100)
  const expired = isDevisExpired((devis.valid_until as string) ?? null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/${locale}/compte`} className="text-sm text-muted underline underline-offset-4">
          {t.back}
        </Link>
        <span className="ms-auto">
          <PrintButton label={t.print} />
        </span>
      </div>

      <h1 className="display mt-6 text-2xl font-semibold sm:text-3xl">{t.title}</h1>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-faint">{t.ref}</dt>
          <dd className="num mt-0.5 font-medium">{isolateNumbers(String(devis.ref_code))}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">{t.date}</dt>
          <dd className="num mt-0.5 font-medium">
            {isolateNumbers(String(devis.sent_at ?? devis.created_at).slice(0, 10))}
          </dd>
        </div>
        {devis.valid_until && (
          <div>
            <dt className="text-xs text-faint">{t.validUntil}</dt>
            <dd className="num mt-0.5 font-medium">
              {isolateNumbers(String(devis.valid_until))}
              {expired && <span className="ms-1 text-xs text-[#a32a24]">· {t.expired}</span>}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-6 overflow-x-auto rounded border border-line">
        <table className="w-full min-w-[32rem] border-collapse bg-surface text-sm">
          <thead>
            <tr>
              <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">
                {t.designation}
              </th>
              <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">
                {t.unit}
              </th>
              <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">
                {t.qty}
              </th>
              <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">
                {t.pu}
              </th>
              <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">
                {t.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={String(l.id)}>
                <td className="border-b border-line p-2.5">
                  <span className="block">{String(l.designation_ar)}</span>
                  <span className="text-xs text-faint">{String(l.lot_name_ar)}</span>
                </td>
                <td className="num border-b border-line p-2.5 text-xs text-muted">
                  {String(l.unit)}
                </td>
                <td className="num border-b border-line p-2.5">
                  {isolateNumbers(String(l.quantity))}
                </td>
                <td className="num border-b border-line p-2.5">
                  {isolateNumbers(formatMoney(Number(l.pu_total_ht ?? 0), locale))}
                </td>
                <td className="num border-b border-line p-2.5 font-medium">
                  {isolateNumbers(formatMoney(Number(l.total_ht ?? 0), locale))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-5 grid justify-items-end gap-1.5 text-sm">
        <div className="flex gap-3">
          <dt className="text-muted">{t.totalHt}</dt>
          <dd className="num font-semibold">{isolateNumbers(formatMoney(totalHt, locale))}</dd>
        </div>
        {rate !== null && (
          <>
            <div className="flex gap-3">
              <dt className="text-muted">
                {t.tax} <span className="num">{isolateNumbers(String(rate))}</span>%
              </dt>
              <dd className="num">{isolateNumbers(formatMoney(totalHt * (rate / 100), locale))}</dd>
            </div>
            <div className="flex gap-3 border-t border-line pt-1.5">
              <dt className="font-semibold">{t.totalTtc}</dt>
              <dd className="num text-lg font-semibold">
                {isolateNumbers(formatMoney(ttc ?? 0, locale))}
              </dd>
            </div>
          </>
        )}
      </dl>

      {(devis.inclusions || devis.exclusions || devis.payment_terms) && (
        <dl className="mt-7 grid gap-4">
          {devis.inclusions && (
            <div>
              <dt className="text-xs text-faint">{t.inclusions}</dt>
              <dd className="mt-0.5 leading-7">{String(devis.inclusions)}</dd>
            </div>
          )}
          {devis.exclusions && (
            <div>
              <dt className="text-xs text-faint">{t.exclusions}</dt>
              <dd className="mt-0.5 leading-7">{String(devis.exclusions)}</dd>
            </div>
          )}
          {devis.payment_terms && (
            <div>
              <dt className="text-xs text-faint">{t.payment}</dt>
              <dd className="mt-0.5 leading-7">{String(devis.payment_terms)}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-8 text-xs leading-7 text-faint">{t.note}</p>
    </div>
  )
}
