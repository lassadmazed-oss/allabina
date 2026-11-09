import Link from 'next/link'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { canonicalUrl, languageAlternates } from '@/lib/site'
import { formatMoney, isolateNumbers } from '@/lib/format'
import {
  getLegalIdentity,
  getPlatformContact,
  legalInLocale,
  telHref,
  waHref,
} from '@/lib/legal'

/**
 * المعطيات القانونية — «شكون انتوما؟» بالورقة.
 *
 * بطاقة وراء بطاقة، كلّ وحدة سؤال واحد: مين، شنوّة يخدم، وين، وكيفاش
 * توصلو. القارئ يهبط ويقرا، ما يواجهش حائط نصّ.
 *
 * المعطيات من القاعدة لا من الشفرة: الخانة الفارغة ما تظهرش أصلاً، حتّى
 * لا تُعرض الشركة ناقصة إن لم تُعمَّر خانة.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).legalPage
  return {
    title: `${t.title} — AL-LUBNA`,
    description: t.lede,
    alternates: {
      canonical: canonicalUrl(locale, '/mentions-legales'),
      languages: languageAlternates('/mentions-legales'),
    },
  }
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).legalPage

  const [identity, contact] = await Promise.all([getLegalIdentity(), getPlatformContact()])
  const l = legalInLocale(identity, locale)
  const dateLocale = locale === 'ar' ? 'fr-TN' : 'fr-FR'
  const d = (iso: string) =>
    iso ? isolateNumbers(new Date(iso).toLocaleDateString(dateLocale)) : ''
  const wa = waHref(contact.whatsapp, t.waPrefill)

  if (!l.name && !identity.uniqueId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-5">
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
        <p className="mt-4 leading-8 text-muted">{t.missing}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5 sm:py-14">
      <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
      <p className="mt-3 leading-8 text-muted">{t.lede}</p>

      {/* 1 — مين */}
      <section className="mt-8 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-sm font-semibold">{t.identity}</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Row k={t.name} v={l.name} />
          <Row k={t.form} v={l.form} />
          <Row k={t.uniqueId} v={identity.uniqueId} mono />
          <Row k={t.registerNo} v={identity.registerNo} mono />
          <Row
            k={t.capital}
            v={identity.capitalTnd == null ? '' : formatMoney(identity.capitalTnd, locale)}
            mono
          />
          <Row k={t.manager} v={identity.manager} />
        </dl>
      </section>

      {/* 2 — شنوّة يخدم */}
      <section className="mt-5 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-sm font-semibold">{t.activityTitle}</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Row k={t.activity} v={l.activity} />
          <Row k={t.activityCode} v={identity.activityCode} mono />
          <Row k={t.activitySince} v={d(identity.activitySince)} mono />
          <Row k={t.publishedOn} v={d(identity.publishedOn)} mono />
        </dl>
        <p className="mt-5 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
          {t.notFinancier}
        </p>
      </section>

      {/* 3 — وين */}
      {l.address && (
        <section className="mt-5 rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold">{t.where}</h2>
          <p className="mt-3 leading-8">{isolateNumbers(l.address)}</p>
        </section>
      )}

      {/* 4 — كيفاش توصلنا */}
      {(contact.phone || wa || contact.email) && (
        <section className="mt-5 rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold">{t.contactTitle}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {contact.phone && (
              <a
                href={telHref(contact.phone)}
                className="num inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-deep"
                dir="ltr"
              >
                {contact.phone}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition hover:border-brand hover:text-brand"
              >
                {t.whatsapp}
              </a>
            )}
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Row k={t.email} v={contact.email} />
            <Row k={t.hours} v={contact.hours} />
          </dl>
        </section>
      )}

      {/* 5 — تثبّت بنفسك */}
      {identity.verifyUrl && (
        <section className="mt-5 rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold">{t.verify}</h2>
          <p className="mt-2 text-sm leading-7 text-muted">{t.verifyNote}</p>
          <a
            href={identity.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
            dir="ltr"
          >
            registre-entreprises.tn
          </a>
        </section>
      )}

      <p className="mt-8 text-sm">
        <Link href={path(locale, '/confidentialite')} className="text-brand hover:underline">
          {getDictionary(locale).footer.privacy}
        </Link>
      </p>
    </div>
  )
}

/** سطر يختفي كلّياً إن كانت قيمته فارغة — لا شرطة ولا خانة بيضاء */
function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  if (!v) return null
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className={`mt-0.5 leading-7${mono ? ' num' : ''}`}>{v}</dd>
    </div>
  )
}
