import { readFileSync } from 'node:fs'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { costPerM2, generateDevis, type ArticleInput, type ProjectConfig } from '@/lib/devis'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const ref = new URL(env.SUPABASE_URL!).hostname.split('.')[0]

const project: ProjectConfig = {
  surface: 120, levels: 1, bedrooms: 3, livingRooms: 1, kitchens: 1,
  bathrooms: 2, garage: true, terrasse: false, jardin: false, landArea: 400,
}

/**
 * فحص معايرة البوردرو — يتّصل بقاعدة البيانات، فهو خارج مجموعة الاختبارات
 * العادية (tests/**) اللي تخدم بلا شبكة. للتشغيل:  npm run check:bordereau
 *
 * الثابتة المحروسة: مجموع العرض التفصيلي لكلّ مستوى = سعر المتر المربّع
 * المعلن في standing_levels. كي تغيّر الإدارة سعر مقال بلا ما تعدّل
 * الشبكة، هذا الفحص يقول قدّاش بعدت الشبكتان على بعضهما.
 */
describe('معايرة البوردرو', () => {
  it('كلّ مستوى يعطي د/م² قريباً من سعره المعلن', async () => {
    const c = new pg.Client({
      host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432,
      user: `postgres.${ref}`, password: env.DATABASE_PASSWORD, database: 'postgres',
      ssl: { rejectUnauthorized: false },
    })
    await c.connect()
    const levels = (await c.query('select code, price_ht_m2 from standing_levels order by code')).rows
    const rows = (await c.query(
      `select a.id, a.code, l.code lot_code, l.name_ar lot_name, a.designation_ar,
              a.unit, a.qty_formula, a.pu_fourniture_ht, a.pu_main_oeuvre_ht, a.standing
       from articles a join lots l on l.id = a.lot_id where a.is_active`
    )).rows
    await c.end()

    for (const lv of levels) {
      const articles: ArticleInput[] = rows
        .filter((r) => r.standing === null || r.standing === lv.code)
        .map((r) => ({
          id: r.id, code: r.code, lotCode: r.lot_code, lotNameAr: r.lot_name,
          designationAr: r.designation_ar, unit: r.unit, qtyFormula: r.qty_formula,
          puFournitureHt: Number(r.pu_fourniture_ht), puMainOeuvreHt: Number(r.pu_main_oeuvre_ht),
        }))
      const res = generateDevis(project, articles)
      const perM2 = costPerM2(res, project.surface) ?? 0
      const target = Number(lv.price_ht_m2)
      const drift = ((perM2 - target) / target) * 100
      console.log(
        `${lv.code}: ${Math.round(res.totalHt).toLocaleString('fr')} د.ت · ` +
        `${Math.round(perM2)} د/م² (الهدف ${target}) · انحراف ${drift.toFixed(1)}% · ` +
        `${res.lines.length} سطر · أخطاء ${res.errors.length}`
      )
      expect(res.errors).toHaveLength(0)
      expect(Math.abs(drift)).toBeLessThan(1)
    }
  }, 30000)
})
