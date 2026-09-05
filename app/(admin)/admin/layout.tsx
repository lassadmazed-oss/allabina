import Link from 'next/link'
import { getCurrentStaff } from '@/lib/auth'
import { can, ROLE_LABELS } from '@/lib/permissions'
import { logoutAction } from '@/lib/actions/auth'

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
  if (can(staff.role, 'reference.manage')) {
    links.push({ href: '/admin/bordereau', label: 'البوردرو' })
    links.push({ href: '/admin/partners', label: 'الشركاء' })
    links.push({ href: '/admin/reference', label: 'المعطيات المرجعية' })
  }
  if (can(staff.role, 'team.read')) links.push({ href: '/admin/team', label: 'الفريق' })
  links.push({ href: '/admin/account', label: 'حسابي' })

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="brick" aria-hidden="true" />
              <span className="display font-semibold text-green-deep">اللَّبنة</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded px-2.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-green"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
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
              <span className="rounded-full bg-green-soft px-2.5 py-0.5 text-xs text-green">
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
        <div className="border-b border-[#e8dcc2] bg-bronze-soft">
          <div className="mx-auto max-w-7xl px-5 py-2.5 text-sm text-bronze">
            كلمة سرّك مؤقّتة — غيّرها من{' '}
            <Link href="/admin/account" className="underline">
              صفحة حسابي
            </Link>{' '}
            قبل مواصلة العمل.
          </div>
        </div>
      )}

      {children}
    </>
  )
}
