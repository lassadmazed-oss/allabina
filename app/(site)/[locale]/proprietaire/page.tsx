import PropertyForm from '@/components/PropertyForm'
import { getDelegations, getGovernorates, getImadas } from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.proprietaire.pageTitle }
}

export default async function ProprietairePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  const [governorates, delegations, imadas] = await Promise.all([
    getGovernorates(),
    getDelegations('SFX'),
    getImadas('SFX'),
  ])

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="display text-3xl font-semibold">{t.proprietaire.title}</h1>
      <p className="mt-4 leading-8 text-muted">{t.proprietaire.lede}</p>

      <section className="mt-8 rounded border border-line bg-bronze-soft p-6">
        <h2 className="font-semibold">{t.proprietaire.howTitle}</h2>
        <ol className="mt-3 space-y-2 text-sm leading-7">
          {t.proprietaire.how.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="num shrink-0 font-medium text-bronze">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-line pt-3 text-sm leading-7">
          {t.proprietaire.notPublic}
        </p>
      </section>

      <PropertyForm
        locale={locale}
        t={t.proprietaire}
        governorates={governorates}
        delegations={delegations}
        imadas={imadas}
      />
    </div>
  )
}
