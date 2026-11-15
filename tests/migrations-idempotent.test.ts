import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * حارس الترحيلات: البذر يبذر، ما يدهسش.
 *
 * الترحيلات تُعاد **كلّها** في كلّ نشر — لا سجلّ بصمات، بل جملٌ تتحمّل
 * الإعادة. فسطرٌ مثل:
 *
 *     insert into app_settings (key, value) values (…)
 *     on conflict (key) do update set value = excluded.value;
 *
 * ليس بذراً، بل إعادةُ ضبطٍ دوريّة: كلّ ما يكتبه الفريق في «المعطيات
 * المرجعية» يُمحى عند النشر الموالي ويرجع لما في الملفّ. وقع فعلاً في
 * 15/11/2026 — اسم الوكيل كُتب من الباك أوفيس واختفى بعد `npm run
 * migrate`، والأسوأ أنّه اختفى بصمت: لا خطأ ولا تنبيه، خانةٌ فارغة.
 *
 * والعطب من صنفٍ لا تمسكه شاشة: الشاشة تعرض ما في القاعدة، والقاعدة
 * صارت تعرض ما في الملفّ. فالحارس هنا يقرأ ملفّات SQL نفسها.
 *
 * القاعدة: جملةٌ تمسّ `app_settings.value` بـ`do update` ممنوعة.
 * التصحيح المقصود لقيمةٍ بعينها يكون `update … where` بشرطٍ يحدّ ما
 * يُبدَّل، لا دهساً شاملاً.
 */
const DIR = join(process.cwd(), 'supabase', 'migrations')

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

/** الجملة كما تُقرأ بلا تعليقات: `-- …` لا يُحتسب شفرةً */
const stripComments = (sql: string) =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')

describe('ترحيلات تتحمّل الإعادة', () => {
  it('فمّا ترحيلات أصلاً', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('ما ثمّ ترحيل يدهس app_settings.value عند التعارض', () => {
    const guilty: string[] = []

    for (const f of files) {
      const sql = stripComments(readFileSync(join(DIR, f), 'utf8')).toLowerCase()
      // الجمل التي تخصّ app_settings وحدها: نقطع على الفاصلة المنقوطة
      for (const stmt of sql.split(';')) {
        if (!stmt.includes('app_settings')) continue
        if (!stmt.includes('on conflict')) continue
        const after = stmt.slice(stmt.indexOf('on conflict'))
        if (/do\s+update[\s\S]*\bvalue\s*=/.test(after)) guilty.push(f)
      }
    }

    expect(
      [...new Set(guilty)],
      'بذرُ إعداداتٍ بـ«do update set value» يمحو ما كتبه الفريق عند كلّ نشر'
    ).toEqual([])
  })

  it('والتصحيح الشامل بلا شرط ممنوع كذلك', () => {
    const guilty: { file: string; stmt: string }[] = []

    for (const f of files) {
      const sql = stripComments(readFileSync(join(DIR, f), 'utf8')).toLowerCase()
      for (const raw of sql.split(';')) {
        const stmt = raw.replace(/\s+/g, ' ').trim()
        if (!/^update\s+app_settings\b/.test(stmt)) continue
        if (!/\bvalue\s*=/.test(stmt)) continue
        if (!stmt.includes(' where ')) guilty.push({ file: f, stmt: stmt.slice(0, 90) })
      }
    }

    expect(guilty, 'update على app_settings.value بلا where يدهس كلّ الإعدادات').toEqual([])
  })
})
