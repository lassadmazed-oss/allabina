import { requirePermission } from '@/lib/auth'
import { templateCsv } from '@/lib/catalog-import'

/**
 * قالب الاستيراد — بعلامة BOM.
 *
 * بدونها يفتح Excel الملفّ بترميز النظام فتظهر العربية رموزاً، ويظنّ
 * من يفتحه أنّ القالب مكسور. حرفان في أوّل الملفّ يوفّران هذا كلّه.
 */
export async function GET() {
  await requirePermission('reference.manage')
  return new Response(templateCsv(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="allabina-catalogue-template.csv"',
    },
  })
}
