import Simulator from '@/components/Simulator'
import { getBuildTiers, getFinanceContext, getFinancingProducts } from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function SimulateurPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  const [finance, build, products] = await Promise.all([
    getFinanceContext(),
    getBuildTiers('SFX', locale),
    getFinancingProducts(),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="display text-3xl font-semibold">{t.sim.title}</h1>
        <p className="mt-3 leading-8 text-muted">{t.sim.lede}</p>
      </div>
      <Simulator
        locale={locale}
        t={t.sim}
        labels={t.labels}
        assumptions={finance.assumptions}
        bankTermsNote={finance.bankTermsNote}
        tiers={build.tiers}
        referencePrice={build.referencePrice}
        products={products}
      />
    </div>
  )
}
