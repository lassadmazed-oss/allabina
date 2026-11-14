import type { Metadata } from 'next'
import Link from 'next/link'
import PhoneGate from '@/components/PhoneGate'
import { signOutUserAction } from '@/lib/actions/account'
import { getCurrentUser } from '@/lib/user-session'
import { db } from '@/lib/supabase/server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { isolateNumbers } from '@/lib/format'
import { publicStateOf } from '@/lib/public-state'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').account
  // صفحة شخصية: لا تُفهرس ولا تُتبع
  return { title: t.pageTitle, robots: { index: false, follow: false } }
}

export default async function ComptePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ claimed?: string; next?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.account
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
        <p className="mt-2 leading-8 text-muted">{t.lede}</p>
        <div className="mt-7">
          <PhoneGate locale={locale} t={t} next={sp.next} />
        </div>
      </div>
    )
  }

  const { data: files } = await db
    .from('housing_requests')
    .select('id, ref_code, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const claimed = Number(sp.claimed ?? '')
  const justClaimed = Number.isFinite(claimed) && claimed > 0

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <h1 className="display text-2xl font-semibold sm:text-3xl">
        {t.welcome}
        {user.fullName ? ` ${user.fullName}` : ''}
      </h1>
      <p className="num mt-2 text-muted" dir="ltr">
        {isolateNumbers(user.phone)}
      </p>

      {sp.claimed !== undefined && (
        <p className="mt-6 rounded border border-line bg-gold-soft px-3 py-2.5 text-sm leading-7">
          {justClaimed ? `${t.claimed} ${isolateNumbers(String(claimed))}` : t.claimedNone}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-faint">{t.myFiles}</h2>
        <ul className="mt-3 divide-y divide-line rounded border border-line bg-surface">
          {(files ?? []).map((f) => (
            <li key={String(f.id)} className="flex items-center justify-between gap-3 px-3 py-3">
              <span className="num text-sm font-semibold">{isolateNumbers(String(f.ref_code))}</span>
              {/* الحالة بلغة الحريف لا باسم القيمة في القاعدة */}
              <span className="text-xs text-muted">
                {dict.suivi.states[publicStateOf(String(f.status))] ?? ''}
              </span>
            </li>
          ))}
          {!files?.length && (
            <li className="px-3 py-4 text-sm text-muted">{t.claimedNone}</li>
          )}
        </ul>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/${locale}`} className="text-sm text-muted underline underline-offset-4">
          {dict.nav.brand}
        </Link>
        <form action={signOutUserAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-sm text-muted underline underline-offset-4">
            {t.signOut}
          </button>
        </form>
      </div>
    </div>
  )
}
