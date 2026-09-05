import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import '../../globals.css'
import LangSwitch from '@/components/LangSwitch'
import { LOCALES, dirOf, getDictionary, isLocale, otherLocale, path, type Locale } from '@/lib/i18n'
import { canonicalUrl, languageAlternates, siteUrl } from '@/lib/site'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const l: Locale = isLocale(locale) ? locale : 'ar'

  const meta =
    l === 'fr'
      ? {
          title: 'ALLABINA — Construction & Développement',
          description:
            "Plateforme tunisienne qui structure la demande de logement et met le citoyen en relation avec les solutions de construction, d'immobilier et de financement adaptées à ses moyens.",
          siteName: 'ALLABINA',
          ogLocale: 'fr_TN',
        }
      : {
          title: 'اللَّبنة للبناء والإعمار — نبنيو على قدّك',
          description:
            'منصة تونسية ذكية تجمع مطالب السكن وتربط المواطن بالمشاريع وشركات البناء وحلول التمويل المناسبة لقدرته المالية ومكان السكن المطلوب.',
          siteName: 'اللَّبنة للبناء والإعمار',
          ogLocale: 'ar_TN',
        }

  return {
    metadataBase: new URL(siteUrl()),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonicalUrl(l),
      languages: languageAlternates(),
    },
    openGraph: {
      type: 'website',
      url: canonicalUrl(l),
      siteName: meta.siteName,
      title: meta.title,
      description: meta.description,
      locale: meta.ogLocale,
    },
  }
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const other = otherLocale(locale)
  const p = (s = '') => path(locale, s)

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <Link href={p()} className="flex items-center gap-3">
              <span className="brick" aria-hidden="true" />
              <span className="display text-lg font-semibold text-green-deep">{t.nav.brand}</span>
              <span className="hidden text-xs text-faint sm:inline">{t.nav.brandSub}</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm sm:gap-3">
              <Link href={p('/simulateur')} className="rounded px-2 py-1 text-muted hover:text-green">
                {t.nav.simulator}
              </Link>
              <Link href={p('/suivi')} className="rounded px-2 py-1 text-muted hover:text-green">
                {t.nav.track}
              </Link>
              <Link
                href={p('/realisations')}
                className="hidden rounded px-2 py-1 text-muted hover:text-green lg:inline"
              >
                {t.cases.navLink}
              </Link>
              <Link
                href={p('/soutien')}
                className="hidden rounded px-2 py-1 text-muted hover:text-green lg:inline"
              >
                {t.soutien.navLink}
              </Link>
              <Link
                href={p('/proprietaire')}
                className="hidden rounded px-2 py-1 text-muted hover:text-green md:inline"
              >
                {t.proprietaire.navCta}
              </Link>
              <Suspense fallback={null}>
                <LangSwitch current={locale} other={other} label={t.otherLangName} />
              </Suspense>
              <Link
                href={p('/demande')}
                className="rounded bg-green px-4 py-2 font-medium text-white transition hover:bg-green-deep"
              >
                {t.nav.cta}
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-md">
                <div className="display mb-2 text-base font-semibold text-ink">
                  {t.nav.brand} {locale === 'ar' ? t.nav.brandSub : ''}
                </div>
                <p className="leading-7">{t.footer.about}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={p('/demande')} className="hover:text-green">
                  {t.footer.request}
                </Link>
                <Link href={p('/simulateur')} className="hover:text-green">
                  {t.footer.simulator}
                </Link>
                <Link href={p('/suivi')} className="hover:text-green">
                  {t.footer.track}
                </Link>
                <Link href={p('/realisations')} className="hover:text-green">
                  {t.cases.navLink}
                </Link>
                <Link href={p('/soutien')} className="hover:text-green">
                  {t.soutien.navLink}
                </Link>
                <Link href={p('/proprietaire')} className="hover:text-green">
                  {t.proprietaire.navCta}
                </Link>
                <Link href={p('/confidentialite')} className="hover:text-green">
                  {t.footer.privacy}
                </Link>
              </div>
            </div>
            <div className="mt-8 border-t border-line pt-5 text-xs text-faint">{t.footer.legal}</div>
          </div>
        </footer>
      </body>
    </html>
  )
}
