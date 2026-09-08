import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import '../../globals.css'
import LangSwitch from '@/components/LangSwitch'
import MobileNav from '@/components/MobileNav'
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
          title: 'AL-LUBNA — Construction & Développement',
          description:
            "Plateforme tunisienne qui structure la demande de logement et met le citoyen en relation avec les solutions de construction, d'immobilier et de financement adaptées à ses moyens.",
          siteName: 'AL-LUBNA',
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

  /**
   * مصدر واحد لروابط الموقع: الترويسة والقائمة والذيل. مجمّعة بمنطق رحلة
   * المواطن — ابدا · اعرف · شارك — لا بترتيب ظهورها التاريخي.
   */
  const NAV_GROUPS = [
    {
      title: t.nav.groupStart,
      links: [
        { href: p('/demande'), label: t.footer.request },
        { href: p('/simulateur'), label: t.nav.simulator },
        { href: p('/suivi'), label: t.nav.track },
      ],
    },
    {
      title: t.nav.groupLearn,
      links: [
        { href: p('/standing'), label: t.standingPage.navLink },
        { href: p('/realisations'), label: t.cases.navLink },
      ],
    },
    {
      title: t.nav.groupJoin,
      links: [
        { href: p('/proprietaire'), label: t.proprietaire.navCta },
        { href: p('/reseau'), label: t.reseau.navCta },
        { href: p('/soutien'), label: t.soutien.navLink },
        { href: p('/soutien/demande'), label: t.soutien.askHelp.navCta },
      ],
    },
  ]

  const NAV_LINKS = [
    { href: p('/simulateur'), label: t.nav.simulator },
    { href: p('/suivi'), label: t.nav.track },
    { href: p('/standing'), label: t.standingPage.navLink },
    { href: p('/realisations'), label: t.cases.navLink },
    { href: p('/soutien'), label: t.soutien.navLink },
    { href: p('/proprietaire'), label: t.proprietaire.navCta },
    { href: p('/reseau'), label: t.reseau.navCta },
  ]

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
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            {/* min-h-11: الشعار رابط للرئيسية، وارتفاع 23px لا يُصاب بالإبهام */}
            <Link href={p()} className="flex min-h-11 min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="brick shrink-0" aria-hidden="true" />
              <span className="display truncate text-base font-semibold text-brand-deep sm:text-lg">
                {t.nav.brand}
              </span>
              <span className="hidden text-xs text-faint md:inline">{t.nav.brandSub}</span>
            </Link>

            {/* قائمة الحاسوب — تظهر من lg فما فوق */}
            <nav className="ms-auto hidden items-center gap-1 text-sm lg:flex">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded px-2 py-1.5 text-muted transition hover:text-brand"
                >
                  {l.label}
                </Link>
              ))}
              <Suspense fallback={null}>
                <LangSwitch current={locale} other={other} label={t.otherLangName} />
              </Suspense>
              <Link
                href={p('/demande')}
                className="ms-1 rounded-lg bg-brand px-4 py-2 font-medium text-white transition hover:bg-brand-deep"
              >
                {t.nav.cta}
              </Link>
            </nav>

            {/* التليفون: فعل واحد ظاهر + قائمة كاملة */}
            <div className="ms-auto flex items-center gap-2 lg:hidden">
              <Link
                href={p('/demande')}
                className="flex min-h-11 items-center rounded-lg bg-brand px-3.5 text-sm font-medium text-white transition active:bg-brand-deep"
              >
                {t.nav.cta}
              </Link>
              <MobileNav
                groups={NAV_GROUPS}
                cta={{ href: p('/demande'), label: t.nav.cta }}
                langSwitch={
                  <Suspense fallback={null}>
                    <LangSwitch current={locale} other={other} label={t.otherLangName} />
                  </Suspense>
                }
                labels={{
                  menuTitle: t.nav.menuTitle,
                  menuOpen: t.nav.menuOpen,
                  menuClose: t.nav.menuClose,
                }}
              />
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-16 border-t border-line bg-surface sm:mt-24">
          <div
            className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-5"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="display text-base font-semibold text-ink">
                  {t.nav.brand} {locale === 'ar' ? t.nav.brandSub : ''}
                </div>
                <div className="mb-2 text-sm text-gold">{t.nav.slogan}</div>
                <p className="leading-7">{t.footer.about}</p>
              </div>

              {/* عمودان على التليفون: عمود واحد بأحد عشر رابطاً يطوّل الصفحة بلا فائدة */}
              <nav className="grid w-full grid-cols-2 gap-x-4 gap-y-1 sm:w-auto sm:grid-cols-1 sm:gap-y-2">
                {[...NAV_GROUPS.flatMap((g) => g.links), { href: p('/confidentialite'), label: t.footer.privacy }].map(
                  (l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex min-h-11 items-center transition hover:text-brand sm:min-h-0"
                    >
                      {l.label}
                    </Link>
                  )
                )}
              </nav>
            </div>
            <div className="mt-8 border-t border-line pt-5 text-xs text-faint">{t.footer.legal}</div>
          </div>
        </footer>
      </body>
    </html>
  )
}
