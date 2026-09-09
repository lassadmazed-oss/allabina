import Link from 'next/link'
import SupportRequestForm from '@/components/SupportRequestForm'
import { getDelegations } from '@/lib/supabase/server'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.soutien.askHelp.pageTitle, description: t.soutien.askHelp.lede }
}

export default async function AskHelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const a = t.soutien.askHelp

  const delegations = await getDelegations('SFX')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-12">
      <h1 className="display text-3xl font-semibold">{a.title}</h1>
      <p className="mt-4 leading-8 text-muted">{a.lede}</p>

      <section className="mt-8 rounded border border-line bg-gold-soft p-4 sm:p-6">
        <h2 className="font-semibold">{a.honestTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7">
          {a.honest.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <SupportRequestForm
        voice={t.voice}
        locale={locale}
        govCode="SFX"
        delegations={delegations.map((d) => ({ id: d.id, name_ar: d.name_ar }))}
        t={a}
      />

      <Link
        href={path(locale, '/soutien')}
        className="mt-8 inline-flex min-h-11 items-center text-sm text-muted transition hover:text-brand"
      >
        {a.backToCases}
      </Link>
    </div>
  )
}
