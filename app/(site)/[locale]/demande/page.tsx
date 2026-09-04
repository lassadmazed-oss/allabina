import RequestForm from '@/components/RequestForm'
import {
  getBuildTiers,
  getDelegations,
  getFinanceContext,
  getGovernorates,
  getImadas,
} from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function DemandePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const [{ locale: raw }, { type }] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  const [governorates, delegations, imadas, finance, build] = await Promise.all([
    getGovernorates(),
    getDelegations('SFX'),
    getImadas('SFX'),
    getFinanceContext(),
    getBuildTiers('SFX'),
  ])

  return (
    <div className="bg-ground">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.form.pageTitle}</h1>
          <p className="mt-2 text-muted">{t.form.pageLede}</p>
        </div>
      </div>

      <RequestForm
        locale={locale}
        t={t.form}
        labels={t.labels}
        governorates={governorates}
        delegations={delegations}
        imadas={imadas}
        assumptions={finance.assumptions}
        bankTermsNote={finance.bankTermsNote}
        tiers={build.tiers}
        initialType={type ?? ''}
      />
    </div>
  )
}
