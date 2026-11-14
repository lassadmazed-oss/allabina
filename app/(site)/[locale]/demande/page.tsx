import RequestForm from '@/components/RequestForm'
import { recordEvent } from '@/lib/analytics-server'
import {
  getBanks,
  getBuildTiers,
  getConstructionSystems,
  getDelegations,
  getDocCatalog,
  getFinanceContext,
  getGovernorates,
  getImadas,
  getZones,
} from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { getCurrentUser } from '@/lib/user-session'
import { displayPhone } from '@/lib/account'

export const dynamic = 'force-dynamic'

export default async function DemandePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const type = sp.type

  /*
   * ما جمعه «كوّن مشروعك» يصل هنا فلا يُسأل الحريف مرّتين. الأسماء
   * أسماء خانات الاستمارة نفسها، والقيم تُنظَّف بالعدد لا تُمرَّر كما
   * جاءت: العنوان يكتبه من شاء بما شاء.
   */
  const num = (v: string | undefined, max: number) => {
    const n = Number(String(v ?? '').replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? String(Math.min(Math.round(n), max)) : undefined
  }
  const prefill: Record<string, string> = {}
  const put = (k: string, v: string | undefined) => {
    if (v !== undefined) prefill[k] = v
  }
  put('desiredAreaM2', num(sp.s, 2000))
  put('levels', num(sp.l, 6))
  put('bedrooms', num(sp.ch, 20))
  put('livingRooms', num(sp.sa, 6))
  put('kitchens', num(sp.cu, 4))
  put('bathrooms', num(sp.sdb, 10))
  put('delegationId', num(sp.del, 999999))
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const user = await getCurrentUser()
  // «بدء تجربة»: فتح مكوّن المشروع
  await recordEvent('trial_start', { userId: user?.id ?? null, projectType: type ?? null })

  const [governorates, delegations, imadas, zones, finance, build, systems, docCatalog, banks] =
    await Promise.all([
    getGovernorates(),
    getDelegations('SFX'),
    getImadas('SFX'),
    getZones('SFX'),
    getFinanceContext(),
    getBuildTiers('SFX', locale),
    getConstructionSystems(),
    getDocCatalog(),
    getBanks(),
  ])

  return (
    <div className="bg-ground">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-5 sm:py-8">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.form.pageTitle}</h1>
          <p className="mt-2 text-muted">{t.form.pageLede}</p>
        </div>
      </div>

      <RequestForm
        docCatalog={docCatalog}
        voice={t.voice}
        locale={locale}
        t={t.form}
        labels={t.labels}
        governorates={governorates}
        delegations={delegations}
        imadas={imadas}
        zones={zones}
        assumptions={finance.assumptions}
        bankTermsNote={finance.bankTermsNote}
        banks={banks}
        tiers={build.tiers}
        systems={systems}
        initialType={type ?? ''}
        initialValues={Object.keys(prefill).length ? prefill : undefined}
        account={user ? { phone: displayPhone(user.phone), fullName: user.fullName } : undefined}
      />
    </div>
  )
}
