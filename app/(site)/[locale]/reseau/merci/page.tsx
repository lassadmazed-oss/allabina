import Link from 'next/link'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ReseauThanksPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <div className="rounded border border-line bg-surface p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.reseau.merciTitle}</h1>
        <p className="mt-3 leading-8 text-muted">{t.reseau.merciLede}</p>
        <p className="mt-6 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
          {t.reseau.notApproved}
        </p>
      </div>

      <Link
        href={path(locale)}
        className="mt-6 inline-block rounded border border-line px-6 py-3 text-sm hover:border-line-strong"
      >
        {t.reseau.merciBack}
      </Link>
    </div>
  )
}
