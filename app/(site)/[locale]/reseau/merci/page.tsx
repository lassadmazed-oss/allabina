import Link from 'next/link'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

/** «20 *** 481» — الرقم لصاحبه، لكن الصفحة قد تُفتح على شاشة غيره */
const maskPhone = (p: string) => {
  const d = p.replace(/\D/g, '')
  if (d.length < 6) return p
  return `${d.slice(0, 2)} *** ${d.slice(-3)}`
}
const maskEmail = (e: string) => {
  const [u, dom] = e.split('@')
  if (!dom) return e
  return `${u.slice(0, 2)}***@${dom}`
}

type Contact = { phone: string; whatsapp: string; email: string; hours: string }

async function platformContact(): Promise<Contact> {
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['contact.phone', 'contact.whatsapp', 'contact.email', 'contact.hours'])
  const m = new Map((data ?? []).map((r) => [r.key as string, String(r.value ?? '').trim()]))
  return {
    phone: m.get('contact.phone') ?? '',
    whatsapp: m.get('contact.whatsapp') ?? '',
    email: m.get('contact.email') ?? '',
    hours: m.get('contact.hours') ?? '',
  }
}

export default async function ReseauThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const [{ locale: raw }, { ref }] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).reseau

  const [pro, contact] = await Promise.all([
    ref && /^IN-\d{4}-\d{6}$/.test(ref)
      ? db
          .from('intervenants')
          .select('ref_code, full_name, phone, whatsapp, email, intervenant_categories!intervenants_category_id_fkey(name_ar, name_fr)')
          .eq('ref_code', ref)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    platformContact(),
  ])

  const cat = (pro?.intervenant_categories ?? null) as { name_ar: string; name_fr: string | null } | null
  const catName = cat ? (locale === 'fr' ? cat.name_fr || cat.name_ar : cat.name_ar) : null
  const hasContact = Boolean(contact.phone || contact.whatsapp || contact.email)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5 sm:py-16">
      <div className="rounded border border-line bg-surface p-5 sm:p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.merciTitle}</h1>
        <p className="mt-3 leading-8 text-muted">{t.merciLede}</p>

        {pro && (
          <div className="mt-6 rounded border border-brand/30 bg-brand-soft p-5">
            <div className="text-xs text-muted">{t.refLabel}</div>
            <div className="num mt-1 text-2xl font-semibold text-brand">{pro.ref_code}</div>
            {catName && <div className="mt-1 text-sm text-ink-soft">{catName}</div>}
            <p className="mt-3 text-sm leading-7 text-muted">{fmt(t.smsSent, { phone: maskPhone(pro.phone) })}</p>
          </div>
        )}

        <p className="mt-6 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
          {t.notApproved}
        </p>
      </div>

      {/* كيفاش نوصلولك */}
      {pro && (
        <section className="mt-6 rounded border border-line bg-surface p-4 sm:p-6">
          <h2 className="font-semibold">{t.contactYouTitle}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.contactYouLede}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded border border-line p-3">
              <dt className="text-xs text-muted">{t.phone}</dt>
              <dd className="num mt-1 font-medium" dir="ltr">{maskPhone(pro.phone)}</dd>
            </div>
            <div className="rounded border border-line p-3">
              <dt className="text-xs text-muted">{t.whatsapp}</dt>
              <dd className="num mt-1 font-medium" dir="ltr">
                {pro.whatsapp ? maskPhone(pro.whatsapp) : <span className="text-faint">{t.notProvided}</span>}
              </dd>
            </div>
            <div className="rounded border border-line p-3">
              <dt className="text-xs text-muted">{t.email}</dt>
              <dd className="mt-1 font-medium" dir="ltr">
                {pro.email ? maskEmail(pro.email) : <span className="text-faint">{t.notProvided}</span>}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* كيفاش توصلنا */}
      <section className="mt-6 rounded border border-line bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">{t.contactUsTitle}</h2>
        {hasContact ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {contact.phone && (
              <li className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-muted">{t.phone}</span>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, '')}`}
                  className="num inline-flex min-h-11 items-center text-brand hover:underline"
                  dir="ltr"
                >
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.whatsapp && (
              <li className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-muted">{t.whatsapp}</span>
                <a
                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(pro ? `${t.waPrefill} ${pro.ref_code}` : t.waPrefill)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="num inline-flex min-h-11 items-center text-brand hover:underline"
                  dir="ltr"
                >
                  {contact.whatsapp}
                </a>
              </li>
            )}
            {contact.email && (
              <li className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-muted">{t.email}</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex min-h-11 items-center text-brand hover:underline"
                  dir="ltr"
                >
                  {contact.email}
                </a>
              </li>
            )}
            {contact.hours && <li className="text-xs text-faint">{contact.hours}</li>}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-7 text-muted">{t.contactUsEmpty}</p>
        )}
        <p className="mt-3 text-xs leading-6 text-faint">{t.contactRefHint}</p>
      </section>

      <Link
        href={path(locale)}
        className="mt-6 inline-flex min-h-12 items-center rounded border border-line px-6 text-sm transition hover:border-line-strong"
      >
        {t.merciBack}
      </Link>
    </div>
  )
}
