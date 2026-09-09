import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import { notFound } from 'next/navigation'
import '../../globals.css'
import LangSwitch from '@/components/LangSwitch'
import MobileNav from '@/components/MobileNav'
import BackButton from '@/components/BackButton'
import MobileCta from '@/components/MobileCta'
import DesktopNav, { type DesktopNavItem } from '@/components/DesktopNav'
import { IcArrow, IcTrack } from '@/components/landing/icons'
import { LOCALES, dirOf, getDictionary, isLocale, otherLocale, path, type Locale } from '@/lib/i18n'
import { canonicalUrl, languageAlternates, siteUrl } from '@/lib/site'
import { landingCopy } from '@/components/landing/copy'

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
  const lc = landingCopy[locale]

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
        { href: p('/a-propos'), label: landingCopy[locale].nav.about },
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
   * قائمة الحاسوب: أربعة عناصر بدل تسعة روابط في سطر — رابطان مباشران
   * وقائمتان منسدلتان بنفس تجميع قائمة التليفون. «ابدا من هنا» على الزرّ
   * وفي «تتبّع مطلبي» بجانبه، فلا تُكرَّر في القائمة.
   */
  const DESKTOP_NAV: DesktopNavItem[] = [
    { kind: 'link', href: p('/a-propos'), label: landingCopy[locale].nav.about },
    { kind: 'link', href: p('/realisations'), label: t.cases.navLink, showFrom: 'xl' },
    {
      kind: 'menu',
      label: t.nav.groupLearn,
      links: [
        { href: p('/simulateur'), label: t.nav.simulator },
        { href: p('/realisations'), label: t.cases.navLink, hideFrom: 'xl' },
        { href: p('/systemes'), label: t.systemsPage.navLink },
        { href: p('/standing'), label: t.standingPage.navLink },
      ],
    },
    { kind: 'menu', label: t.nav.groupJoin, links: NAV_GROUPS[2].links },
  ]

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
        <header className="sticky top-0 z-40 border-b border-line/70 bg-ground/85 backdrop-blur-xl transition-shadow duration-300 data-scrolled:shadow-[0_12px_32px_-20px_rgba(14,58,91,0.4)]">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-5 2xl:max-w-[1400px] lg:h-20 lg:gap-4 lg:px-8 xl:gap-6 xl:px-10">
            {/* التليفون: رجوع خارج الرئيسية — سهم النظام يخرج من الموقع أو يغيب */}
            <BackButton home={p()} label={lc.nav.back} />

            {/* الشعار: المَعلَم + الاسم نصّاً، والاسم الفرعي من مقاس الحاسوب. shrink-0: لا ينضغط أبداً */}
            <Link href={p()} className="flex shrink-0 items-center" aria-label={t.nav.brand}>
              <BrandLogo brand={t.nav.brand} sub={t.nav.brandSub} size={44} subFrom="xl" />
            </Link>

            {/* قائمة الحاسوب — من lg فما فوق، في وسط الشريط */}
            <nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label={t.nav.menuTitle}>
              <DesktopNav items={DESKTOP_NAV} />
            </nav>

            {/* الحاسوب: تتبّع · اللغة · زرّ التسجيل */}
            <div className="ms-auto hidden shrink-0 items-center gap-2 lg:flex">
              <Link
                href={p('/suivi')}
                title={t.nav.track}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong/60 bg-surface/70 px-3 text-sm font-semibold text-brand transition hover:border-brand hover:bg-surface 2xl:px-4"
              >
                <IcTrack className="size-[18px]" />
                <span className="hidden 2xl:inline">{t.nav.track}</span>
              </Link>
              <Suspense fallback={null}>
                <LangSwitch
                  current={locale}
                  other={other}
                  label={t.otherLangName}
                  className="inline-flex h-10 items-center rounded-full px-3 text-xs font-bold text-muted transition hover:bg-surface hover:text-brand"
                />
              </Suspense>
              <Link
                href={p('/demande')}
                className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-brand ps-5 pe-1.5 text-[15px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(14,58,91,0.65)] transition hover:-translate-y-px hover:bg-brand-deep"
              >
                {t.nav.cta}
                <span className="flex size-8 items-center justify-center rounded-full bg-gold-light text-brand-deep transition group-hover:bg-white">
                  <IcArrow className="size-4 rtl:-scale-x-100" />
                </span>
              </Link>
            </div>

            {/* التليفون: زرّ التسجيل في الرئيسية (خارجها زرّ الرجوع مكانه) + قائمة كاملة */}
            <div className="ms-auto flex items-center gap-2 lg:hidden">
              <MobileCta home={p()} href={p('/demande')} label={lc.nav.ctaShort} />
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

        {/* التذييل: دعوة أخيرة، ثمّ الهوية وثلاث مجموعات روابط بعناوينها، ثمّ السطر القانوني */}
        <footer className="mt-16 rounded-t-[40px] bg-gradient-to-b from-brand to-brand-deep text-white sm:mt-24">
          <div
            className="mx-auto max-w-[1240px] px-5 pt-8 lg:px-10 lg:pt-12"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex flex-col gap-5 rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <b className="display block text-xl font-bold sm:text-2xl">{lc.footer.ctaTitle}</b>
                <p className="mt-1 max-w-xl text-sm leading-7 text-white/70 sm:text-base">{lc.footer.ctaText}</p>
              </div>
              <Link
                href={p('/demande')}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gold-light px-6 font-bold text-brand-deep shadow-[0_12px_28px_-10px_rgba(212,161,94,0.7)] transition hover:bg-white"
              >
                {t.nav.cta}
                <IcArrow className="size-4 rtl:-scale-x-100" />
              </Link>
            </div>

            {/* على التليفون: الهوية بعرض الصفحة ثمّ المجموعات عمودين؛ على الحاسوب أربعة أعمدة */}
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8 lg:mt-14">
              <div className="col-span-2 max-w-sm md:col-span-1">
                {/* الشعار الكامل — حروفه بيضاء، فمكانه الأرضية الداكنة وحدها */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/logo-full.png"
                  alt={`${t.nav.brand} ${t.nav.brandSub}`}
                  className="w-auto"
                  style={{ height: 84 }}
                  width={612}
                  height={408}
                  decoding="async"
                />
                <div className="mt-4 text-sm font-semibold text-gold-light">{t.nav.slogan}</div>
                <p className="mt-2 text-sm leading-7 text-white/70">{t.footer.about}</p>
              </div>
              {NAV_GROUPS.map((g) => (
                <nav key={g.title} aria-label={g.title}>
                  <h3 className="text-xs font-bold text-gold-light ltr:uppercase ltr:tracking-[0.16em]">{g.title}</h3>
                  <ul className="mt-3 flex flex-col">
                    {g.links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          className="flex min-h-10 items-center text-[15px] leading-snug text-white/85 transition hover:text-white"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
              <span>{t.footer.legal}</span>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link href={p('/confidentialite')} className="transition hover:text-white">
                  {t.footer.privacy}
                </Link>
                <span className="tracking-[0.2em] text-white/60" dir="ltr">
                  SAME ROOTS · BRIGHTER TOMORROWS
                </span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
