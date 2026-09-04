import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="display text-3xl font-semibold">{t.privacy.title}</h1>
      <p className="mt-4 leading-8 text-muted">{t.privacy.lede}</p>

      <Section title={t.privacy.s1}>
        <ul className="space-y-2">
          {t.privacy.s1items.map((i) => (
            <li key={i}>— {i}</li>
          ))}
        </ul>
        <p className="mt-4">{t.privacy.s1end}</p>
      </Section>

      <Section title={t.privacy.s2}>
        <p>{t.privacy.s2body}</p>
      </Section>

      <Section title={t.privacy.s3}>
        <p>{t.privacy.s3body}</p>
      </Section>

      <Section title={t.privacy.s4}>
        <p>{t.privacy.s4body}</p>
      </Section>

      <Section title={t.privacy.s5}>
        <p>{t.privacy.s5body}</p>
      </Section>

      <p className="mt-10 rounded border border-line bg-bronze-soft p-5 text-sm leading-7">
        {t.privacy.note}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 leading-8 text-muted">{children}</div>
    </section>
  )
}
