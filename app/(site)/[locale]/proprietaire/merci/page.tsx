import Link from 'next/link'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function PropertyThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5 sm:py-16">
      <div className="rounded border border-line bg-surface p-5 sm:p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          {t.proprietaire.thanksTitle}
        </h1>
        <p className="mt-3 leading-8 text-muted">{t.proprietaire.thanksBody}</p>

        {sp.ref && (
          <div className="mt-8 rounded border border-line bg-brand-soft p-4 sm:p-6">
            <div className="text-sm text-muted">{t.proprietaire.refLabel}</div>
            <div className="num mt-1 text-3xl font-semibold text-brand" dir="ltr">
              {sp.ref}
            </div>
          </div>
        )}

        <p className="mt-6 text-sm leading-7 text-muted">{t.proprietaire.notPublic}</p>
      </div>

      <Link
        href={path(locale)}
        className="mt-6 inline-flex min-h-12 items-center rounded border border-line px-6 text-sm transition hover:border-line-strong"
      >
        {t.proprietaire.backHome}
      </Link>
    </div>
  )
}
