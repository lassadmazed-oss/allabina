import IntervenantForm from '@/components/IntervenantForm'
import { db, getDelegations, getZones } from '@/lib/supabase/server'
import { AVAILABILITY_LABELS, LEGAL_LABELS, type CategoryRow, type FamilyRow, type SkillRow } from '@/lib/network'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.reseau.pageTitle }
}

export default async function ReseauPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  const [{ data: families }, { data: categories }, { data: skills }, delegations, zones] =
    await Promise.all([
      db.from('intervenant_families').select('code, name_ar, name_fr').order('sort_order'),
      db
        .from('intervenant_categories')
        .select('id, code, family_code, name_ar, name_fr')
        .eq('is_active', true)
        .order('family_code')
        .order('sort_order'),
      db
        .from('skills')
        .select('id, category_id, name_ar, name_fr')
        .eq('is_active', true)
        .order('sort_order'),
      getDelegations('SFX'),
      getZones('SFX'),
    ])

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="display text-3xl font-semibold">{t.reseau.title}</h1>
      <p className="mt-4 leading-8 text-muted">{t.reseau.lede}</p>

      <section className="mt-8 rounded border border-line bg-gold-soft p-6">
        <h2 className="font-semibold">{t.reseau.howTitle}</h2>
        <ol className="mt-3 space-y-2 text-sm leading-7">
          {t.reseau.how.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="num shrink-0 font-medium text-gold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <IntervenantForm
        locale={locale}
        govCode="SFX"
        families={(families ?? []) as FamilyRow[]}
        categories={(categories ?? []) as CategoryRow[]}
        skills={(skills ?? []) as SkillRow[]}
        delegations={delegations.map((d) => ({ id: d.id, name_ar: d.name_ar }))}
        zones={(zones ?? []).map((z) => ({ id: z.id, name_ar: z.name_ar }))}
        t={{
          ...t.reseau,
          legalLabels: LEGAL_LABELS,
          availabilityLabels: AVAILABILITY_LABELS,
        }}
      />
    </div>
  )
}
