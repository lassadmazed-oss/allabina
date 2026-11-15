import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { generateDevis, type ArticleInput, type ProjectConfig } from '@/lib/devis'
import { reachOf, type Reach } from '@/lib/budget-reach'

// configFromParams خالصة، فمحلّها lib/budget-reach.ts — تُعاد هنا
// لمن يستوردها من الخادم بلا تبديل مواضع الاستيراد.
export { configFromParams } from '@/lib/budget-reach'

/**
 * حساب «بميزانيتك توصل لوين» من البوردرو نفسه.
 *
 * المستوى المستعمل هو **الأرخص**، وهو الجواب الصحيح على السؤال
 * المطروح: «قدّاش توصل بفلوسك». بمواد أغلى يوصل أقلّ — ويُقال ذلك
 * صراحةً على الشاشة بدل أن يُكتشف في العرض.
 *
 * ولا يُقرأ هنا شيء من حساب الحريف: الصفحة عمومية، والحساب يقع على
 * البوردرو المنشور لا على ملفّ أحد.
 */
export const BASE_STANDING = 'B01'

const toInput = (r: Record<string, unknown>): ArticleInput => {
  const raw = r.lots as Record<string, unknown> | Record<string, unknown>[] | null
  const lot = Array.isArray(raw) ? raw[0] : raw
  return {
    id: String(r.id),
    code: String(r.code),
    lotCode: Number(lot?.code ?? 0),
    lotNameAr: String(lot?.name_ar ?? ''),
    designationAr: String(r.designation_ar ?? ''),
    unit: String(r.unit ?? ''),
    qtyFormula: String(r.qty_formula ?? ''),
    puFournitureHt: Number(r.pu_fourniture_ht ?? 0),
    puMainOeuvreHt: Number(r.pu_main_oeuvre_ht ?? 0),
  }
}

/** مقالات الأساس — المستوى الأرخص، المشتغلة وحدها */
export const getBaseArticles = cache(async (): Promise<ArticleInput[]> => {
  const { data } = await db
    .from('articles')
    .select(
      'id, code, designation_ar, unit, qty_formula, pu_fourniture_ht, pu_main_oeuvre_ht, lots(code, name_ar)'
    )
    .eq('standing', BASE_STANDING)
    .eq('is_active', true)
    .order('code')
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toInput)
})

export type BudgetAnswer = {
  reach: Reach
  config: ProjectConfig
  /** صيغٌ لم تُفهم — تُقال ولا تُبتلع، لأنّ المجموع يصير ناقصاً بلا أن يُرى */
  skipped: number
}

export async function budgetReach(config: ProjectConfig, budget: number): Promise<BudgetAnswer> {
  const articles = await getBaseArticles()
  const devis = generateDevis(config, articles)
  return {
    reach: reachOf(devis.lots, budget),
    config,
    skipped: devis.errors.length,
  }
}
