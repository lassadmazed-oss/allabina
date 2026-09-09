import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import { notFound } from 'next/navigation'
import '../../globals.css'
import LangSwitch from '@/components/LangSwitch'
import MobileNav from '@/components/MobileNav'
import { LOCALES, dirOf, getDictionary, isLocale, otherLocale, path, type Locale } from '@/lib/i18n'
import { canonicalUrl, languageAlternates, siteUrl } from '@/lib/site'

/**
 * لون شريط المتصفّح على التليفون: بلا هذا يبقى أبيض النظام فوق ترويسة
 * بيضاء، فيبدو الموقع كصفحة داخل متصفّح لا كتطبيق. maximum-scale لا
 * نضعه: منع التكبير يمنع من يحتاجه.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#0a2a44' },
  ],
  colorScheme: 'light',
}

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
            "Plateforme tunisienne qui structure la demande de logement et met le client en relation avec les solutions de construction, d'immobilier et de financement adaptées à ses moyens.",
          siteName: 'AL-LUBNA',
          ogLocale: 'fr_TN',
        }
      : {
          title: 'اللَّبنة للبناء والإعمار — نبنيو على قدّك',
          description:
            'منصة تونسية ذكية تجمع مطالب السكن وتربط الحريف بالمشاريع وشركات البناء وحلول التمويل المناسبة لقدرته المالية ومكان السكن المطلوب.',
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
   * الحريف — ابدا · اعرف · شارك — لا بترتيب ظهورها التاريخي.
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
        { href: p('/systemes'), label: t.systemsPage.navLink },
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

  /**
   * ثمانية روابط + اللغة + الزرّ لا تتّسع تحت 1350 بكسل: كانت تركب على
   * الشعار، ثمّ تقصّ الزرّ. الأولوية بدل الحشر — روابط «انضمّ» الثلاثة
   * في التذييل وفي القائمة، وتظهر فوق حين يتّسع المكان.
   */
  const NAV_LINKS: { href: string; label: string; hideBelow?: 'xl' | '2xl' }[] = [
    { href: p('/simulateur'), label: t.nav.simulator },
    { href: p('/suivi'), label: t.nav.track },
    { href: p('/systemes'), label: t.systemsPage.navLink },
    { href: p('/standing'), label: t.standingPage.navLink },
    { href: p('/realisations'), label: t.cases.navLink },
    { href: p('/soutien'), label: t.soutien.navLink, hideBelow: '2xl' },
    { href: p('/proprietaire'), label: t.proprietaire.navCta, hideBelow: 'xl' },
    { href: p('/reseau'), label: t.reseau.navCta, hideBelow: 'xl' },
  ]
  const hideCls = { xl: 'hidden xl:inline-flex', '2xl': 'hidden 2xl:inline-flex' } as const

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl 2xl:max-w-7xl items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            {/* min-h-11: الشعار رابط للرئيسية، وارتفاع 23px لا يُصاب بالإبهام */}
            {/* الشعار: المصباح والمباني — ملفّ مستخرَج من لوحة الهوية (public/landing) */}
            {/* shrink-0: الشعار لا ينضغط أبداً — كان min-w-0 يتركه ينكمش فتفيض حروفه تحت القائمة */}
            <Link href={p()} className="flex min-h-11 shrink-0 items-center" aria-label={t.nav.brand}>
              <BrandLogo brand={t.nav.brand} sub={t.nav.brandSub} size={48} subFrom="xl" />
            </Link>

            {/* قائمة الحاسوب — تظهر من lg فما فوق */}
            <nav className="ms-auto hidden min-w-0 items-center gap-0.5 overflow-x-auto text-[13px] [scrollbar-width:none] lg:flex xl:text-sm">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`whitespace-nowrap rounded-full px-2 py-1.5 font-semibold text-brand transition hover:bg-brand-soft xl:px-3 ${l.hideBelow ? hideCls[l.hideBelow] : ''}`}
                >
                  {l.label}
                </Link>
              ))}
              <Suspense fallback={null}>
                <LangSwitch current={locale} other={other} label={t.otherLangName} />
              </Suspense>
              <Link
                href={p('/demande')}
                className="ms-1 whitespace-nowrap rounded-full bg-brand px-5 py-2.5 font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand-deep"
              >
                {t.nav.cta}
              </Link>
            </nav>

            {/* التليفون: فعل واحد ظاهر + قائمة كاملة */}
            <div className="ms-auto flex items-center gap-2 lg:hidden">
              <Link
                href={p('/demande')}
                className="flex min-h-11 items-center whitespace-nowrap rounded-full bg-brand px-4 text-sm font-bold text-white transition active:bg-brand-deep"
              >
                {t.nav.cta}
              </Link>
              <MobileNav
                groups={NAV_GROUPS}
                cta={{ href: p('/demande'), label: t.nav.cta }}
                freeNote={t.nav.ctaFree}
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

        <footer className="mt-16 rounded-t-[40px] bg-gradient-to-b from-brand to-brand-deep text-white sm:mt-24">
          <div
            className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/80 sm:px-5"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="max-w-md">
                {/* الشعار الكامل — حروفه بيضاء، فمكانه الأرضية الداكنة وحدها */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/logo-full.png"
                  alt={`${t.nav.brand} ${t.nav.brandSub}`}
                  className="w-auto"
                  style={{ height: 96 }}
                  width={612}
                  height={408}
                  decoding="async"
                />
                <div className="mb-2 mt-3 text-sm text-gold-light">{t.nav.slogan}</div>
                <p className="leading-7">{t.footer.about}</p>
              </div>

              {/* عمودان على التليفون: عمود واحد بأحد عشر رابطاً يطوّل الصفحة بلا فائدة */}
              <nav className="grid w-full grid-cols-2 gap-x-4 gap-y-1 sm:w-auto sm:grid-cols-1 sm:gap-y-2">
                {[...NAV_GROUPS.flatMap((g) => g.links), { href: p('/confidentialite'), label: t.footer.privacy }].map(
                  (l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex min-h-11 items-center font-medium text-white/85 transition hover:text-gold-light sm:min-h-0"
                    >
                      {l.label}
                    </Link>
                  )
                )}
              </nav>
            </div>
            <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
              <span>{t.footer.legal}</span>
              <span className="tracking-[0.2em] text-white/70" dir="ltr">
                SAME ROOTS · BRIGHTER TOMORROWS
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
