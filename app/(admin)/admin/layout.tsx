import Link from 'next/link'
import { getCurrentStaff } from '@/lib/auth'
import { can, ROLE_LABELS } from '@/lib/permissions'
import { logoutAction } from '@/lib/actions/auth'
import { Suspense } from 'react'
import SaveToast from '@/components/SaveToast'
import NumericFocusSelect from '@/components/NumericFocusSelect'
import AdminShell, { type ShellLink } from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'

/**
 * غلاف اللوحة. عند غياب الجلسة يعرض المحتوى عارياً — وهي حالة /admin/login وحدها،
 * لأنّ middleware يحوّل بقيّة المسارات إلى صفحة الدخول.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff()
  if (!staff) return <>{children}</>

  const links: ShellLink[] = [
    { href: '/admin/tableau', label: 'لوحة القيادة', icon: 'grid' },
    { href: '/admin', label: 'المطالب', icon: 'clipboard' },
    { href: '/admin/properties', label: 'العقارات', icon: 'building' },
    { href: '/admin/cases', label: 'الحالات المنجزة', icon: 'award' },
    { href: '/admin/support', label: 'المساندة', icon: 'hands' },
  ]
  if (can(staff.role, 'requests.read')) {
    links.push({ href: '/admin/chantiers', label: 'الورشات', icon: 'helmet' })
  }
  if (can(staff.role, 'docs.approve')) {
    links.push({ href: '/admin/approbations', label: 'صندوق الموافقات', icon: 'check-circle' })
  }
  if (can(staff.role, 'network.read')) {
    links.push({ href: '/admin/reseau', label: 'شبكة المتدخّلين', icon: 'users' })
  }
  if (can(staff.role, 'reference.manage')) {
    links.push({ href: '/admin/systemes', label: 'طرق البناء', icon: 'bricks' })
    links.push({ href: '/admin/bordereau', label: 'البوردرو', icon: 'file' })
    links.push({ href: '/admin/produits', label: 'المنتجات', icon: 'box' })
    links.push({ href: '/admin/standing', label: 'مستويات التشطيب', icon: 'layers' })
    links.push({ href: '/admin/regions', label: 'قواعد المناطق', icon: 'map' })
    links.push({ href: '/admin/partners', label: 'الشركاء', icon: 'briefcase' })
    links.push({ href: '/admin/reference', label: 'المعطيات المرجعية', icon: 'gear' })
  }
  if (can(staff.role, 'requests.export')) {
    links.push({ href: '/admin/marche', label: 'الطلب الحقيقي', icon: 'chart' })
  }
  if (can(staff.role, 'team.read')) links.push({ href: '/admin/team', label: 'الفريق', icon: 'users' })
  links.push({ href: '/admin/account', label: 'حسابي', icon: 'user' })

  const tools = can(staff.role, 'requests.export') ? (
    <a
      href="/admin/export"
      className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-line-strong sm:block"
    >
      تصدير CSV
    </a>
  ) : null

  return (
    <AdminShell
      links={links}
      staffName={staff.fullName}
      roleLabel={ROLE_LABELS[staff.role]}
      tools={
        <>
          {tools}
          <form action={logoutAction}>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-line-strong">
              خروج
            </button>
          </form>
        </>
      }
    >
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
    </AdminShell>
  )
}
