import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import CatalogImport from '@/components/CatalogImport'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'استيراد الكاتالوج — اللَّبنة' }

export default async function ImportPage() {
  await requirePermission('reference.manage')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin/bordereau" className="text-sm text-muted hover:text-brand">
        ← البوردرو
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">استيراد الكاتالوج</h1>
      <p className="mt-1 max-w-2xl text-sm leading-7 text-muted">
        ملفّ CSV من Excel. <b>ما يتكتب حتّى سطر قبل ما تشوف شنوّة باش يتبدّل</b> — المعاينة تعرض
        «من» و«إلى» لكلّ خانة، وتقرير الأخطاء بالسطر وسببه.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          href="/admin/bordereau/import/template"
          className="rounded border border-line px-3 py-2"
          download
        >
          حمّل القالب
        </a>
      </div>

      <div className="mt-6 rounded border border-line bg-surface p-4">
        <CatalogImport />
      </div>

      <div className="mt-6 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
        <b>الصيغة:</b> XLSX ما زال ما يتقراش مباشرة. من Excel: «حفظ باسم» ← <span dir="ltr">CSV UTF-8</span>.
        الصيغة هذي تحفظ العربية صحيحة، والعادية لا.
      </div>
    </div>
  )
}
