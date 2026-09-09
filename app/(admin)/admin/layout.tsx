import Link from 'next/link'
import { getCurrentStaff } from '@/lib/auth'
import { can, ROLE_LABELS } from '@/lib/permissions'
import { logoutAction } from '@/lib/actions/auth'
import { Suspense } from 'react'
import SaveToast from '@/components/SaveToast'
import NumericFocusSelect from '@/components/NumericFocusSelect'

export const dynamic = 'force-dynamic'

/**
 * غلاف اللوحة. عند غياب الجلسة يعرض المحتوى عارياً — وهي حالة /admin/login وحدها،
 * لأنّ middleware يحوّل بقيّة المسارات إلى صفحة الدخول.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()
  if (!staff) return <>{children}</>

  const links: { href: string; label: string }[] = [
    { href: '/admin', label: 'المطالب' },
    { href: '/admin/properties', label: 'العقارات' },
    { href: '/admin/cases', label: 'الحالات المنجزة' },
    { href: '/admin/support', label: 'المساندة' },
  ]
  if (can(staff.role, 'network.read')) {
    links.push({ href: '/admin/reseau', label: 'شبكة المتدخّلين' })
  }
  if (can(staff.role, 'reference.manage')) {
    links.push({ href: '/admin/systemes', label: 'طرق البناء' })
    links.push({ href: '/admin/bordereau', label: 'البوردرو' })
    links.push({ href: '/admin/standing', label: 'مستويات التشطيب' })
    links.push({ href: '/admin/partners', label: 'الشركاء' })
    links.push({ href: '/admin/reference', label: 'المعطيات المرجعية' })
  }
  if (can(staff.role, 'team.read')) links.push({ href: '/admin/team', label: 'الفريق' })
  links.push({ href: '/admin/account', label: 'حسابي' })

  return (
    <>
      <header className="border-b border-line bg-surface">
        {/* أحد عشر رابطاً في صفّ واحد يفيضان عن شاشة تليفون بـ455 بكسل.
            على التليفون: الشعار والهويّة في سطر، والتنقّل شريط يُسحب
            بالإبهام في سطر تحته. من lg يعود الصفّ الواحد كما كان. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
          <Link href="/admin" className="order-1 flex min-h-11 items-center gap-2.5">
            <span className="brick shrink-0" aria-hidden="true" />
            <span className="display font-semibold text-brand-deep">اللَّبنة</span>
          </Link>

          <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 pb-0.5 text-sm lg:order-2 lg:mx-0 lg:me-auto lg:w-auto lg:overflow-x-visible lg:px-0 lg:pb-0">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="shrink-0 rounded px-2.5 py-1.5 whitespace-nowrap text-muted transition hover:bg-surface-2 hover:text-brand"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="order-2 flex items-center gap-3 text-sm lg:order-3">
            {can(staff.role, 'requests.export') && (
              <a
                href="/admin/export"
                className="rounded border border-line px-3 py-1.5 text-muted transition hover:border-line-strong"
              >
                تصدير CSV
              </a>
            )}
            <span className="flex items-center gap-2">
              <span className="font-medium">{staff.fullName}</span>
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand">
                {ROLE_LABELS[staff.role]}
              </span>
            </span>
            <form action={logoutAction}>
              <button className="rounded border border-line px-3 py-1.5 text-muted transition hover:border-line-strong">
                خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      {staff.mustChangePassword && (
        <div className="border-b border-[#ecdcb8] bg-gold-soft">
          <div className="mx-auto max-w-7xl px-5 py-2.5 text-sm text-gold">
            كلمة سرّك مؤقّتة — غيّرها من{' '}
            <Link href="/admin/account" className="underline">
              صفحة حسابي
            </Link>{' '}
            قبل مواصلة العمل.
          </div>
        </div>
      )}

      <NumericFocusSelect />
      {children}

      {/* تأكيد الحفظ — يقرأ ?saved من العنوان ويختفي وحده */}
      <Suspense fallback={null}>
        <SaveToast />
      </Suspense>
    </>
  )
}
