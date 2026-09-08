import Link from 'next/link'
import type { Metadata } from 'next'
import RequestForm from '@/components/RequestForm'
import { loadOwnRequest, closeOwnerSession } from '@/lib/actions/request-edit'
import {
  getBuildTiers,
  getDelegations,
  getFinanceContext,
  getGovernorates,
  getImadas,
  getZones,
} from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  // صفحة ملفّ شخصي: لا تُفهرس ولا تُتبع
  return { title: t.suivi.edit.pageTitle, robots: { index: false, follow: false } }
}

export default async function ModifierPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.suivi.edit

  const own = await loadOwnRequest()

  // الجلسة سالات أو ما تفتحتش أصلاً: باب الدخول لا رسالة خطأ جافّة
  if (!own) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5 sm:py-16">
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.expiredTitle}</h1>
        <p className="mt-3 leading-8 text-muted">{t.expiredBody}</p>
        <Link
          href={path(locale, '/suivi')}
          className="mt-6 inline-flex min-h-12 items-center rounded bg-brand px-6 font-medium text-white transition hover:bg-brand-deep"
        >
          {dict.suivi.edit.open}
        </Link>
      </div>
    )
  }

  const [governorates, delegations, imadas, zones, finance, build] = await Promise.all([
    getGovernorates(),
    getDelegations('SFX'),
    getImadas('SFX'),
    getZones('SFX'),
    getFinanceContext(),
    getBuildTiers('SFX', locale),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-5 sm:pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.heading}</h1>
          <p className="mt-2 leading-8 text-muted">
            {fmt(t.subheading, { ref: own.refCode })}
          </p>
        </div>
        <form action={closeOwnerSession}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded border border-line px-4 text-sm text-muted transition hover:border-line-strong"
          >
            {t.leave}
          </button>
        </form>
      </div>

      {sp.saved === '1' && (
        <p
          role="status"
          className="mt-6 rounded border border-brand/40 bg-brand-soft px-4 py-3 text-sm leading-7 text-brand"
        >
          {t.saved}
        </p>
      )}

      {own.ownerUpdatedAt && (
        <p className="mt-4 text-xs text-faint">
          {t.lastEdit}{' '}
          <span className="num">
            {new Date(own.ownerUpdatedAt).toLocaleDateString(locale === 'ar' ? 'fr-TN' : 'fr-FR')}
          </span>
        </p>
      )}

      <p className="mt-4 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-xs leading-6 text-gold">
        {t.notEditable} {t.sessionNote}
      </p>

      <RequestForm
        mode="edit"
        initialValues={own.values}
        locale={locale}
        t={dict.form}
        labels={dict.labels}
        governorates={governorates}
        delegations={delegations}
        imadas={imadas}
        zones={zones}
        assumptions={finance.assumptions}
        bankTermsNote={finance.bankTermsNote}
        tiers={build.tiers}
      />
    </div>
  )
}
