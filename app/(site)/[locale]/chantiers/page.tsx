import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { isolateNumbers } from '@/lib/format'
import { CHANTIER_AR, type ChantierStatus } from '@/lib/site-reports'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').chantiers
  return { title: t.pageTitle, description: t.lede }
}

/**
 * ورشاتنا — ما نُشر بموافقة صاحبه واعتماد الإدارة.
 *
 * الترشيح بـis_public وحده يكفي: القاعدة لا تسمح بأن يكون صحيحاً بلا
 * الموافقتين. ولا يخرج من السطر إلّا ما كُتب للعموم — لا اسم ولا
 * عنوان ولا مبلغ، كما يشترط القسم 09.
 */
export default async function ChantiersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).chantiers

  const { data } = await db
    .from('chantiers')
    .select('code, public_title, public_summary, status, delivered_at')
    .eq('is_public', true)
    .order('delivered_at', { ascending: false, nullsFirst: false })
    .limit(30)

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
      <p className="mt-2 max-w-2xl leading-8 text-muted">{t.lede}</p>

      {items.length === 0 ? (
        <p className="mt-8 rounded border border-line bg-surface px-4 py-6 leading-8 text-muted">
          {t.empty}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <li key={String(c.code)} className="rounded border border-line bg-surface p-4">
              <h2 className="font-semibold leading-7">{String(c.public_title ?? t.untitled)}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {CHANTIER_AR[String(c.status) as ChantierStatus] ?? ''}
                {c.delivered_at ? (
                  <>
                    {' · '}
                    <span className="num">{isolateNumbers(String(c.delivered_at))}</span>
                  </>
                ) : null}
              </p>
              {c.public_summary && (
                <p className="mt-2 text-sm leading-7 text-ink-soft">{String(c.public_summary)}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-7 text-faint">{t.note}</p>

      <section className="mt-10 rounded border border-line bg-gold-soft p-5">
        <h2 className="display text-lg font-semibold">{t.ctaTitle}</h2>
        <Link
          href={`/${locale}/projet`}
          className="mt-4 inline-block rounded bg-brand px-5 py-3 font-semibold text-white"
        >
          {t.cta}
        </Link>
      </section>
    </div>
  )
}
